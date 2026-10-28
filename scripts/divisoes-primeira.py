# -*- coding: utf-8 -*-
"""
Escreve a primeira divisao de cada pais a mao, onde da para saber qual e.

A coluna `division` do `clubs.csv` nunca foi preenchida: os 1.818 clubes estavam todos marcados como divisao
1. O servidor enche a divisao por ordem de chegada ate vinte (`joinOrCreateLeague`), entao a primeira divisao
de cada pais virava os vinte primeiros do arquivo, que estao em ordem alfabetica. Na Argentina isso dava
Acassuso, All Boys e Atlanta; em Portugal dava o Benfica B na frente do Benfica.

Ordenar por forca nao resolve, e foi o que tentei primeiro: as notas dos jogadores no arquivo sao ruido em
volta de 64 (o Benfica tem media 64,0 e o Benfica B tem 65,8), e as capacidades de estadio sao inventadas com
teto em 39 mil na maioria dos paises. Nao existe sinal automatico confiavel, entao a primeira divisao e
escrita.

Casa por nome, ignorando acento e maiuscula, e avisa em voz alta quem nao encontrar, porque um clube que nao
casa some da primeira divisao sem ninguem notar.
"""
import io
import csv
import re
import unicodedata
import collections

PRIMEIRA_DIVISAO = {
    'ENG': ['Liverpool', 'Arsenal', 'Manchester City', 'Chelsea', 'Newcastle United', 'Aston Villa',
            'Nottingham Forest', 'Brighton', 'Bournemouth', 'Brentford', 'Fulham', 'Crystal Palace',
            'Everton', 'West Ham United', 'Manchester United', 'Wolverhampton Wanderers', 'Tottenham Hotspur',
            'Leeds United', 'Burnley', 'Sunderland'],
    'ESP': ['Real Madrid', 'Barcelona', 'Atlético de Madrid', 'Athletic Club', 'Villarreal', 'Real Betis',
            'Celta de Vigo', 'Rayo Vallecano', 'Osasuna', 'Mallorca', 'Real Sociedad', 'Valencia',
            'Getafe', 'Espanyol', 'Alavés', 'Sevilla', 'Girona', 'Elche', 'Levante', 'Real Oviedo'],
    'ITA': ['Napoli', 'Inter de Milão', 'Atalanta', 'Juventus', 'AS Roma', 'Fiorentina', 'Lazio',
            'AC Milan', 'Bologna', 'Como 1907', 'Torino', 'Udinese', 'Genoa', 'Hellas Verona', 'Cagliari',
            'Parma', 'Lecce', 'Pisa', 'Cremonese', 'Sassuolo'],
    'GER': ['Bayern de Munique', 'Bayer Leverkusen', 'Eintracht Frankfurt', 'Borussia Dortmund',
            'Freiburg', 'Mainz 05', 'RB Leipzig', 'Werder Bremen', 'Stuttgart',
            'Borussia Mönchengladbach', 'Wolfsburg', 'Augsburg', 'Union Berlin', 'St. Pauli',
            'Hoffenheim', 'Heidenheim', 'Hamburgo', 'Köln'],
    'FRA': ['Paris Saint-Germain', 'Marseille', 'Monaco', 'Nice', 'Lille', 'Lyon', 'Strasbourg', 'Lens',
            'Brest', 'Toulouse', 'Auxerre', 'Rennes', 'Nantes', 'Angers', 'Le Havre', 'Metz', 'Paris FC',
            'Lorient'],
    'POR': ['Sporting', 'Benfica', 'Porto', 'Braga', 'Vitória de Guimarães', 'Santa Clara', 'Famalicão',
            'Estoril', 'Casa Pia', 'Rio Ave', 'Arouca', 'Estrela Amadora', 'Moreirense',
            'Gil Vicente', 'AVS', 'Alverca', 'Tondela'],
    'NED': ['PSV', 'Ajax', 'Feyenoord', 'AZ Alkmaar', 'Utrecht', 'Twente', 'Go Ahead Eagles',
            'NEC Nijmegen', 'Sparta Rotterdam', 'Fortuna Sittard', 'Heerenveen', 'Groningen', 'Heracles',
            'Zwolle', 'NAC Breda', 'Excelsior', 'Telstar', 'Volendam'],
    'ARG': ['River Plate', 'Boca Juniors', 'Racing Club', 'Independiente', 'San Lorenzo',
            'Vélez Sarsfield', 'Estudiantes', 'Rosario Central', 'Newells Old Boys', 'Talleres',
            'Lanús', 'Argentinos Juniors', 'Huracán', 'Defensa y Justicia', 'Godoy Cruz', 'Banfield',
            'Tigre', 'Platense', 'Instituto', 'Atlético Tucumán'],
    'MEX': ['América', 'Cruz Azul', 'Tigres UANL', 'Monterrey', 'Guadalajara', 'Pumas UNAM', 'Toluca',
            'Pachuca', 'León', 'Santos Laguna', 'Atlas', 'Necaxa', 'Puebla', 'Tijuana', 'Querétaro',
            'Juárez', 'Mazatlán', 'Atlético San Luis'],
    'USA': ['Inter Miami', 'LA Galaxy', 'Los Angeles FC', 'Seattle Sounders', 'Atlanta United',
            'New York City', 'New York Red Bulls', 'Philadelphia Union', 'Columbus Crew',
            'Portland Timbers', 'Chicago Fire', 'FC Dallas', 'Sporting Kansas City', 'Houston Dynamo',
            'Orlando City', 'D.C. United', 'New England Revolution', 'Colorado Rapids',
            'San Jose Earthquakes', 'Minnesota United'],
    'TUR': ['Galatasaray', 'Fenerbahçe', 'Besiktas', 'Trabzonspor', 'Basaksehir', 'Samsunspor',
            'Göztepe Izmir', 'Konyaspor', 'Rizespor', 'Kasimpasa', 'Antalyaspor', 'Alanyaspor',
            'Gaziantep', 'Eyüpspor', 'Kayserispor', 'Genclerbirligi', 'Karagümrük', 'Kocaelispor'],
    'JPN': ['Kashima Antlers', 'Vissel Kobe', 'Sanfrecce Hiroshima', 'Kawasaki Frontale',
            'Urawa Reds', 'Yokohama F. Marinos', 'Gamba Osaka', 'Cerezo Osaka', 'FC Tokyo',
            'Nagoya Grampus', 'Kyoto Sanga', 'Avispa Fukuoka', 'Machida Zelvia', 'Shimizu S-Pulse',
            'Kashiwa Reysol', 'Albirex Niigata', 'Consadole Sapporo', 'Shonan Bellmare',
            'Tokyo Verdy', 'Yokohama FC'],
    'CHI': ['Colo Colo', 'Universidad de Chile', 'Universidad Católica', 'Cobresal', 'Huachipato',
            'Palestino', 'Audax Italiano', 'Coquimbo Unido', 'O’Higgins', 'Unión Española',
            'Unión La Calera', 'Ñublense', 'Deportes Iquique', 'Deportes La Serena',
            'Cobreloa', 'Deportes Limache', 'Deportes Copiapó'],
    'COL': ['Atlético Nacional', 'Millonarios', 'América de Cali', 'Deportivo Cali', 'Junior',
            'Independiente Medellín', 'Santa Fe', 'Deportes Tolima', 'Once Caldas', 'Bucaramanga',
            'Alianza Petrolera', 'Envigado', 'Deportivo Pasto', 'Boyacá Chicó', 'Llaneros', 'Union Magdalena', 'Deportivo Pereira'],
    'URU': ['Peñarol', 'Nacional', 'Defensor Sporting', 'Danubio', 'Liverpool', 'Montevideo Torque',
            'Cerro Largo', 'Boston River', 'Progreso', 'Racing URU', 'Miramar Misiones',
            'Plaza Colonia', 'Juventud', 'River Plate', 'Wanderers', 'Cerro'],
    'PER': ['Universitario', 'Alianza Lima', 'Sporting Cristal', 'Melgar', 'Cienciano', 'Cusco FC',
            'Sport Huancayo', 'Atlético Grau', 'Alianza Atlético', 'Deportivo Garcilaso',
            'Sport Boys', 'ADT', 'Comerciantes Unidos', 'Los Chankas', 'Juan Pablo II',
            'Ayacucho FC', 'UTC', 'Binacional'],
    'ECU': ['Independiente del Valle', 'LDU Quito', 'Barcelona SC', 'Emelec', 'Universidad Católica',
            'Aucas', 'Delfín', 'Orense', 'Macará', 'Técnico Universitario', 'Mushuc Runa',
            'El Nacional', 'Libertad', 'Vinotinto', 'Nueve de Octubre', 'Manta'],
    'PAR': ['Olimpia', 'Cerro Porteño', 'Libertad', 'Guaraní', 'Nacional', 'Sportivo Luqueño',
            'General Caballero', 'Sportivo Trinidense', 'Sportivo Ameliano', '2 de Mayo',
            'Tacuary', '12 de Junio'],
    'KSA': ['Al-Hilal', 'Al-Nassr', 'Al-Ittihad', 'Al-Ahli', 'Al-Ettifaq', 'Al-Shabab',
            'Al-Taawoun', 'Al-Fateh', 'Al-Khaleej', 'Al-Riyadh', 'Al-Fayha', 'Al-Okhdood',
            'Damac', 'Al-Wehda', 'Al-Kholood', 'Al-Najma', 'Neom'],
    'SCO': ['Celtic', 'Hibernian', 'Dundee United', 'Aberdeen', 'Hearts', 'St Mirren',
            'Motherwell', 'Kilmarnock', 'Dundee FC', 'Ross County', 'St Johnstone'],
    'CHN': ['Shanghai Port', 'Shanghai Shenhua', 'Beijing Guoan', 'Shandong Taishan', 'Chengdu Rongcheng',
            'Zhejiang', 'Tianjin Jinmen Tiger', 'Wuhan Three Towns', 'Henan', 'Qingdao Hainiu',
            'Changchun Yatai', 'Meizhou Hakka', 'Yunnan Yukun', 'Dalian Yingbo', 'Qingdao West Coast',
            'Shenzhen Peng City'],
    'KOR': ['Jeonbuk Hyundai', 'Pohang Steelers', 'FC Seoul', 'Gangwon FC', 'Suwon FC',
            'Daejeon Hana Citizen', 'Gwangju FC', 'Jeju SK', 'Daegu', 'Gimcheon Sangmu',
            'FC Anyang', 'Ulsan'],
    'EGY': ['Al Ahly', 'Zamalek', 'Pyramids', 'Al Masry', 'Ismaily', 'Ceramica Cleopatra',
            'ENPPI', 'Smouha', 'National Bank', 'Pharco', 'ZED FC', 'El Gouna', 'Petrojet'],
    'VEN': ['Caracas', 'Deportivo Táchira', 'Carabobo', 'Zamora', 'Metropolitanos', 'Monagas',
            'Estudiantes de Mérida', 'Portuguesa', 'Academia Puerto Cabello', 'Rayo Zuliano',
            'Deportivo La Guaira', 'Universidad Central', 'Anzoátegui'],
    'BOL': ['Bolívar', 'The Strongest', 'Always Ready', 'Blooming', 'Oriente Petrolero', 'Nacional Potosí',
            'Aurora', 'Guabirá', 'Real Tomayapo', 'San Antonio Bulo Bulo', 'GV San José', 'Universitario'],
    'RSA': ['Mamelodi Sundowns', 'Orlando Pirates', 'Kaizer Chiefs', 'TS Galaxy', 'Stellenbosch',
            'Sekhukhune United', 'Golden Arrows', 'Polokwane City', 'Chippa United', 'AmaZulu',
            'Richards Bay', 'Marumo Gallants'],
    'SUI': ['FC Basel', 'Young Boys', 'Servette', 'Lugano', 'FC Zürich', 'St. Gallen', 'FC Luzern',
            'Grasshopper', 'Lausanne-Sport', 'Sion', 'Winterthur', 'Thun'],
    'NZL': ['Auckland City', 'Auckland United', 'Christchurch United', 'Birkenhead United',
            'Eastern Suburbs', 'Cashmere Technical', 'Bay Olympic', 'Coastal Spirit', 'Melville United',
            'Napier City Rovers', 'Petone', 'Western Springs', 'Hamilton Wanderers'],
}

POR_DIVISAO = 20


def norm(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    s = s.replace('’', '').replace("'", '')
    return re.sub(r'[^a-z0-9]', '', s)


def main():
    linhas = list(csv.reader(io.open('content/clubs.csv', encoding='utf-8-sig')))
    cabecalho, rows = linhas[0], [r for r in linhas[1:] if r and len(r) > 3]

    porPais = collections.defaultdict(list)
    for r in rows:
        porPais[r[2]].append(r)

    naoEncontrados = []
    aproximados = []
    curados = 0

    for pais, nomes in PRIMEIRA_DIVISAO.items():
        lista = porPais.get(pais, [])
        if not lista:
            naoEncontrados.append((pais, '(pais inteiro ausente)'))
            continue

        porNome = {}
        for r in lista:
            porNome.setdefault(norm(r[1]), r)

        # Tudo cai para a segunda divisao, e a primeira e reconstruida a partir da lista.
        for r in lista:
            r[3] = '2'

        primeira = []
        for nome in nomes:
            alvo = norm(nome)
            r = porNome.get(alvo)
            if r is None:
                # O arquivo escreve o nome por extenso: "Wolverhampton Wanderers" para "Wolves", "Olympique
                # Marseille" para "Marseille". Casa por prefixo dos dois lados, e o casamento fica registrado
                # para conferencia, porque uma aproximacao errada poe o clube errado na primeira divisao.
                candidatos = [
                    (k, v) for k, v in porNome.items()
                    if v[3] != '1' and len(k) >= 4 and (k.startswith(alvo) or alvo.startswith(k) or alvo in k)
                    # Um time de reservas ou uma equipa B nao e o clube: "Auckland FC" casava com "Auckland
                    # FC Reserves" e punha o time B na primeira divisao.
                    and not re.search(r'(reserves?|b)$', v[1].strip(), re.I)
                ]
                candidatos.sort(key=lambda kv: abs(len(kv[0]) - len(alvo)))
                if candidatos:
                    r = candidatos[0][1]
                    aproximados.append((pais, nome, r[1]))
            if r is None:
                naoEncontrados.append((pais, nome))
                continue
            r[3] = '1'
            primeira.append(r)

        # Divisao impar nao gera returno duplo: o mais fraco espera a proxima temporada.
        if len(primeira) % 2 == 1:
            primeira[-1][3] = '2'

        # O que sobrar alem da segunda divisao vai para a terceira, para nao inchar o acesso.
        resto = [r for r in lista if r[3] == '2']
        for i, r in enumerate(resto):
            if i >= POR_DIVISAO:
                r[3] = '3'

        curados += 1

    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n')
    w.writerow(cabecalho)
    for r in rows:
        w.writerow(r)
    io.open('content/clubs.csv', 'w', encoding='utf-8', newline='').write(buf.getvalue())

    print(f'paises com primeira divisao escrita a mao: {curados}')
    print(f'casados por aproximacao (conferir): {len(aproximados)}')
    for pais, pedido, achado in aproximados:
        print(f'  {pais}: "{pedido}" -> "{achado}"')
    print()
    print(f'clubes que a lista pediu e o arquivo nao tem: {len(naoEncontrados)}')
    for pais, nome in naoEncontrados:
        print(f'  {pais}: {nome}')


if __name__ == '__main__':
    main()
