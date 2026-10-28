# -*- coding: utf-8 -*-
"""
Preenche as ligas que existiam no arquivo com clubes demais para caberem numa lista e de menos para
formarem um campeonato.

O que entra aqui e o que o formato ja previa: nome, pais, divisao, capacidade do estadio e uma nota de
forca na sexta coluna. Nenhum jogador. O `clubs.csv` ja trazia 21 clubes assim, o Manchester City entre
eles, e o jogo gera o elenco a partir da nota, do mesmo jeito que faz com um clube fundado do zero.

Sobre a precisao: os nomes dos clubes sao reais e as capacidades sao aproximadas. As notas sao estimativa
de nivel competitivo, encaixadas na mesma faixa dos clubes que ja estavam no arquivo (62 a 68 no topo),
com o meio de tabela entre 57 e 62. Os elencos sao gerados, nao sao os de verdade.
"""
import io
import csv
import re
import unicodedata

APOSTROFO = "’"

# pais -> [(nome, capacidade aproximada, nota de forca)]
LIGAS = {
    'BEL': [('Gent', 20000, 64), ('Union Saint-Gilloise', 9400, 64), ('Cercle Brugge', 8000, 61),
            ('KV Mechelen', 16700, 61), ('OH Leuven', 10000, 60), ('Westerlo', 8000, 60),
            ('Sint-Truiden', 14600, 60), ('KV Kortrijk', 9500, 59), ('Zulte Waregem', 12500, 59),
            ('Beerschot', 8000, 58), ('Eupen', 8000, 58), ('Dender EH', 6800, 57)],
    'POL': [('Legia Warszawa', 31103, 66), ('Rakow Czestochowa', 5500, 65), ('Pogon Szczecin', 21163, 64),
            ('Jagiellonia Bialystok', 22386, 64), ('Gornik Zabrze', 24563, 62), ('Wisla Krakow', 33130, 62),
            ('Cracovia', 15016, 62), ('Slask Wroclaw', 45105, 61), ('Zaglebie Lubin', 16068, 61),
            ('Widzew Lodz', 18018, 61), ('Korona Kielce', 15550, 60), ('Radomiak Radom', 10000, 60),
            ('Stal Mielec', 6864, 59), ('Warta Poznan', 2500, 58), ('Ruch Chorzow', 9300, 58),
            ('Motor Lublin', 15200, 57)],
    'RUS': [('Krasnodar', 34291, 65), ('Rubin Kazan', 45105, 63), ('Rostov', 45000, 62),
            ('Akhmat Grozny', 30597, 62), ('Krylia Sovetov', 44918, 61), ('Ural Yekaterinburg', 35000, 61),
            ('Sochi', 44287, 60), ('Orenburg', 10000, 60), ('Fakel Voronezh', 32750, 59),
            ('Baltika Kaliningrad', 35212, 59), ('Pari Nizhny Novgorod', 44899, 59), ('Khimki', 5100, 58),
            ('Dynamo Makhachkala', 15200, 57)],
    'UKR': [('Vorskla Poltava', 24795, 62), ('Oleksandriya', 7000, 61), ('Rukh Lviv', 34915, 60),
            ('Chornomorets Odesa', 34164, 60), ('Metalist 1925 Kharkiv', 40003, 60), ('Veres Rivne', 12000, 59),
            ('Obolon Kyiv', 5100, 59), ('LNZ Cherkasy', 5000, 58), ('Karpaty Lviv', 34915, 58),
            ('Kryvbas Kryvyi Rih', 31000, 58), ('Inhulets Petrove', 3000, 57), ('Polissya Zhytomyr', 5300, 60),
            ('Livyi Bereh Kyiv', 2000, 57)],
    'CRO': [('Slaven Belupo', 3134, 61), ('Istra 1961', 8923, 60), ('HNK Gorica', 5200, 60),
            ('Varazdin', 10800, 59), ('Sibenik', 8000, 59), ('Rudes', 5000, 58), ('NK Zagreb', 8850, 58),
            ('Cibalia', 8000, 57), ('Dugopolje', 5200, 57), ('Vukovar 1991', 3000, 57),
            ('Karlovac 1919', 12000, 57), ('Bjelovar', 6000, 57), ('Hrvatski Dragovoljac', 5000, 57)],
    'GRE': [('Panathinaikos', 16003, 66), ('Atromitos', 10200, 62), ('Asteras Tripolis', 7500, 61),
            ('Volos NPS', 5500, 60), ('Lamia', 5500, 59), ('Panetolikos', 7500, 59), ('Levadiakos', 5900, 58),
            ('Kifisia', 3000, 58), ('Panserraikos', 9000, 58), ('Athens Kallithea', 4500, 57),
            ('PAS Giannina', 7500, 59), ('Ionikos', 5500, 57), ('Apollon Smyrnis', 14200, 57)],
    'AUT': [('Austria Wien', 17500, 64), ('Austria Klagenfurt', 30000, 61), ('Blau-Weiss Linz', 5595, 60),
            ('SCR Altach', 8500, 60), ('WSG Tirol', 5900, 60), ('SV Ried', 7680, 59), ('Grazer AK', 15400, 59),
            ('First Vienna', 4500, 58), ('Admira Wacker', 12000, 58), ('SKN St. Polten', 8000, 58),
            ('Kapfenberger SV', 12000, 57), ('FC Dornbirn', 9000, 57)],
    'DEN': [('Nordsjaelland', 10300, 64), ('Silkeborg', 10000, 63), ('Viborg', 10000, 62),
            ('OB Odense', 15790, 62), ('Lyngby', 10000, 61), ('Vejle', 10428, 60), ('AaB Aalborg', 13800, 61),
            ('Hvidovre', 12000, 59), ('FC Fredericia', 10000, 58), ('Kolding IF', 10000, 58),
            ('Hobro IK', 7500, 58), ('HB Koge', 4000, 57)],
    'NOR': [('Brann', 17686, 64), ('Lillestrom', 11637, 63), ('Valerenga', 16555, 62),
            ('Sarpsborg 08', 8000, 61), ('Odd', 12000, 61), ('Tromso', 6859, 60), ('Haugesund', 8754, 60),
            ('Sandefjord', 6582, 59), ('Kristiansund', 4444, 59), ('Stromsgodset', 8935, 59),
            ('Fredrikstad', 12500, 59), ('HamKam', 8000, 58), ('KFUM Oslo', 3000, 58), ('Aalesund', 10778, 58)],
    'SWE': [('AIK', 50000, 65), ('BK Hacken', 6316, 64), ('IF Elfsborg', 16800, 64),
            ('IFK Norrkoping', 17234, 63), ('Kalmar FF', 12000, 61), ('Halmstads BK', 15500, 60),
            ('IFK Varnamo', 5000, 59), ('Mjallby AIF', 6600, 60), ('IK Sirius', 10000, 59),
            ('Degerfors IF', 12500, 58), ('Brommapojkarna', 7500, 58), ('Orebro SK', 12000, 58),
            ('GAIS', 18416, 58), ('Vasteras SK', 7500, 57)],
    'CZE': [('Banik Ostrava', 15123, 63), ('Sigma Olomouc', 12566, 62), ('Bohemians 1905', 6300, 61),
            ('Slovacko', 8121, 61), ('Mlada Boleslav', 5000, 60), ('Teplice', 18221, 60),
            ('Hradec Kralove', 9500, 59), ('Zlin', 6375, 59), ('Pardubice', 3000, 58), ('Dukla Praha', 8150, 58),
            ('Karvina', 4200, 58), ('Ceske Budejovice', 6681, 58), ('Banik Most', 7000, 57)],
    'ROU': [('Rapid Bucuresti', 14047, 64), ('Farul Constanta', 15500, 62), ('Dinamo Bucuresti', 15300, 62),
            ('Sepsi OSK', 8400, 61), ('UTA Arad', 12700, 60), ('Petrolul Ploiesti', 15073, 60),
            ('Hermannstadt', 12500, 59), ('Otelul Galati', 13500, 59), ('Poli Iasi', 11390, 58),
            ('FC Voluntari', 4600, 58), ('Universitatea Cluj', 22198, 60), ('Chindia Targoviste', 4600, 57),
            ('Unirea Slobozia', 3000, 57), ('Gloria Buzau', 18000, 57)],
    'SRB': [('Cukaricki', 4070, 63), ('Radnicki Nis', 18500, 62), ('Spartak Subotica', 13000, 61),
            ('Mladost Lucani', 8000, 60), ('Napredak Krusevac', 10331, 59), ('Novi Pazar', 12000, 59),
            ('Javor Ivanjica', 5000, 58), ('Radnik Surdulica', 5000, 58), ('Vozdovac', 5175, 58),
            ('Zeleznicar Pancevo', 8000, 57), ('IMT Beograd', 3000, 57), ('Radnicki 1923', 8000, 58),
            ('Metalac Gornji Milanovac', 4000, 57), ('Tekstilac Odzaci', 3000, 57)],
    'HUN': [('Ujpest', 13500, 63), ('Paksi FC', 6150, 62), ('Kisvarda', 3000, 61),
            ('Zalaegerszeg', 14000, 60), ('Mezokovesd', 5000, 60), ('Diosgyor', 15000, 60),
            ('Kecskemet', 6300, 59), ('Nyiregyhaza', 7500, 59), ('MTK Budapest', 5322, 59),
            ('Gyori ETO', 15600, 60), ('Vasas', 5000, 58), ('Haladas Szombathely', 8903, 58),
            ('Bekescsaba', 7000, 57)],
    'ISR': [('Hapoel Tel Aviv', 13800, 64), ('Maccabi Netanya', 13610, 62), ('Bnei Sakhnin', 5100, 60),
            ('Hapoel Haifa', 30870, 61), ('FC Ashdod', 8000, 60), ('Maccabi Petah Tikva', 11500, 59),
            ('Hapoel Hadera', 5000, 59), ('Ironi Kiryat Shmona', 5300, 58), ('Bnei Yehuda', 13800, 58),
            ('Hapoel Jerusalem', 13800, 58), ('Maccabi Bnei Reineh', 5000, 57),
            ('Sektzia Ness Ziona', 3000, 57), ('Hapoel Katamon', 13800, 57), ('Ironi Tiberias', 3000, 57)],
    'BUL': [('Levski Sofia', 29200, 65), ('Cherno More', 8250, 62), ('Arda Kardzhali', 5000, 61),
            ('Beroe Stara Zagora', 12128, 60), ('Hebar Pazardzhik', 5000, 59), ('Krumovgrad', 3000, 59),
            ('Septemvri Sofia', 4000, 58), ('Spartak Varna', 6000, 58), ('Lokomotiv Sofia', 25000, 59),
            ('Etar Veliko Tarnovo', 18000, 58), ('Montana', 8000, 57), ('Dobrudzha Dobrich', 12000, 57),
            ('Botev Vratsa', 6000, 57)],
    'FIN': [('FC Lahti', 7465, 62), ('SJK Seinajoki', 5817, 62), ('VPS Vaasa', 6000, 61),
            ('FC Haka', 3500, 60), ('KTP Kotka', 4780, 59), ('AC Oulu', 4392, 59), ('IF Gnistan', 4000, 58),
            ('FF Jaro', 5000, 58), ('TPS Turku', 9372, 58), ('Ekenas IF', 3000, 57), ('MP Mikkeli', 3000, 57),
            ('KPV Kokkola', 5000, 57), ('IFK Mariehamn', 1600, 58)],
    'SVK': [('Spartak Trnava', 18448, 64), ('Podbrezova', 3200, 61), ('AS Trencin', 4200, 60),
            ('Zemplin Michalovce', 4400, 59), ('MFK Skalica', 3000, 59), ('FC Kosice', 6754, 60),
            ('KFC Komarno', 3000, 58), ('Tatran Presov', 6300, 58), ('FC Nitra', 7480, 58),
            ('Dukla Banska Bystrica', 10000, 58), ('Slovan Sala', 3000, 57), ('Liptovsky Mikulas', 3000, 57),
            ('Zlate Moravce', 3400, 57), ('MSK Puchov', 3000, 57)],
    'CYP': [('AEK Larnaca', 13032, 64), ('Pafos FC', 9394, 63), ('AEL Limassol', 10700, 61),
            ('Nea Salamina', 5500, 59), ('Ethnikos Achna', 7000, 58), ('Enosis Neon Paralimni', 5800, 58),
            ('Doxa Katokopias', 3000, 58), ('Karmiotissa', 3000, 57), ('Akritas Chlorakas', 3000, 57),
            ('Olympiakos Nicosia', 22859, 58), ('Othellos Athienou', 3000, 57), ('ASIL Lysi', 3000, 57),
            ('Digenis Morphou', 3000, 57)],
    'KAZ': [('Tobol Kostanay', 8352, 64), ('Aktobe', 12729, 63), ('Shakhter Karagandy', 19000, 61),
            ('Zhenis Astana', 12350, 60), ('Atyrau', 8500, 59), ('Kyzylzhar', 8300, 60),
            ('Turan Turkistan', 8000, 58), ('Elimai Semey', 8000, 58), ('Okzhetpes', 6000, 58),
            ('Maktaaral', 6000, 57), ('Caspiy Aktau', 6000, 58), ('Aksu', 5000, 57), ('Taraz', 10000, 57),
            ('Zhetysu', 8500, 57)],
    'BLR': [('Neman Grodno', 8443, 63), ('Torpedo-BelAZ Zhodino', 6524, 62), ('Isloch Minsk Raion', 3000, 61),
            ('Slutsk', 1896, 59), ('Vitebsk', 8144, 59), ('Gomel', 14307, 60), ('Slavia Mozyr', 5500, 59),
            ('Naftan Novopolotsk', 6500, 58), ('FC Minsk', 3000, 58), ('Smolevichi', 1500, 57),
            ('Belshina Bobruisk', 3550, 57), ('Molodechno', 5500, 57), ('Energetik-BGU Minsk', 1500, 58),
            ('Dnepr Mogilev', 7350, 57)],
    'SVN': [('Celje', 13059, 63), ('Mura', 3782, 61), ('NK Bravo', 2000, 60), ('Domzale', 3212, 60),
            ('Koper', 4047, 60), ('Aluminij', 1500, 58), ('Radomlje', 1500, 58), ('Rogaska', 1500, 57),
            ('Tabor Sezana', 1500, 57), ('Nova Gorica', 3100, 58), ('Krsko', 1500, 57),
            ('Triglav Kranj', 3000, 57), ('Dob', 1500, 57), ('Nafta 1903', 3000, 57), ('Beltinci', 2000, 57),
            ('Primorje', 2000, 57)],
}


def fazer_slug(nome, pais):
    texto = unicodedata.normalize('NFKD', nome).encode('ascii', 'ignore').decode()
    texto = re.sub(r'[^a-zA-Z0-9]+', '-', texto).strip('-').lower()
    return '%s-%s' % (texto, pais.lower())


def main():
    caminho = 'content/clubs.csv'
    linhas = io.open(caminho, encoding='utf-8-sig').read().rstrip('\n').split('\n')

    # Um clube ja no arquivo nao entra de novo, nem pelo slug nem pelo nome dentro do mesmo pais.
    vistos = set()
    for linha in linhas[1:]:
        if not linha.strip():
            continue
        celulas = next(csv.reader([linha]))
        vistos.add(celulas[0])
        vistos.add((celulas[1].strip().lower(), celulas[2]))

    novas = []
    pulados = 0
    for pais, clubes in LIGAS.items():
        for nome, capacidade, nota in clubes:
            chave = (nome.strip().lower(), pais)
            slug = fazer_slug(nome, pais)
            if chave in vistos or slug in vistos:
                pulados += 1
                continue
            vistos.add(chave)
            vistos.add(slug)
            buf = io.StringIO()
            csv.writer(buf, lineterminator='').writerow([slug, nome, pais, '1', str(capacidade), str(nota)])
            novas.append(buf.getvalue())

    io.open(caminho, 'w', encoding='utf-8', newline='').write('\n'.join(linhas + novas) + '\n')
    print('clubes acrescentados: %d   duplicados evitados: %d' % (len(novas), pulados))


if __name__ == '__main__':
    main()
