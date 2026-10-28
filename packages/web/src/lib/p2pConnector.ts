import type { P2PMessagePayload } from '@tactical-arena/shared';

export class P2PConnector {
  private pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;
  private onMessageCallback?: (payload: P2PMessagePayload) => void;
  private onStatusChangeCallback?: (status: string) => void;

  constructor() {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
    });
  }

  public setOnMessage(cb: (payload: P2PMessagePayload) => void) {
    this.onMessageCallback = cb;
  }

  public setOnStatusChange(cb: (status: string) => void) {
    this.onStatusChangeCallback = cb;
  }

  public async createRoom(): Promise<string> {
    this.updateStatus('Criando sala P2P...');
    this.channel = this.pc.createDataChannel('tactical-arena-p2p');
    this.setupChannel();

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    return new Promise((resolve) => {
      if (this.pc.iceGatheringState === 'complete') {
        resolve(btoa(JSON.stringify(this.pc.localDescription)));
      } else {
        this.pc.onicegatheringstatechange = () => {
          if (this.pc.iceGatheringState === 'complete') {
            resolve(btoa(JSON.stringify(this.pc.localDescription)));
          }
        };
        // Timeout de segurança caso ICE demore
        setTimeout(() => {
          if (this.pc.localDescription) {
            resolve(btoa(JSON.stringify(this.pc.localDescription)));
          }
        }, 1500);
      }
    });
  }

  public async joinRoom(offerB64: string): Promise<string> {
    this.updateStatus('Entrando na sala P2P...');
    this.pc.ondatachannel = (event) => {
      this.channel = event.channel;
      this.setupChannel();
    };

    const offer = JSON.parse(atob(offerB64));
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    return new Promise((resolve) => {
      if (this.pc.iceGatheringState === 'complete') {
        resolve(btoa(JSON.stringify(this.pc.localDescription)));
      } else {
        this.pc.onicegatheringstatechange = () => {
          if (this.pc.iceGatheringState === 'complete') {
            resolve(btoa(JSON.stringify(this.pc.localDescription)));
          }
        };
        setTimeout(() => {
          if (this.pc.localDescription) {
            resolve(btoa(JSON.stringify(this.pc.localDescription)));
          }
        }, 1500);
      }
    });
  }

  public async acceptAnswer(answerB64: string): Promise<void> {
    const answer = JSON.parse(atob(answerB64));
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    this.updateStatus('Conectado via P2P!');
  }

  public send(payload: P2PMessagePayload) {
    if (this.channel && this.channel.readyState === 'open') {
      this.channel.send(JSON.stringify(payload));
    }
  }

  private setupChannel() {
    if (!this.channel) return;
    this.channel.onopen = () => this.updateStatus('Conectado com sucesso!');
    this.channel.onclose = () => this.updateStatus('Conexão encerrada.');
    this.channel.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as P2PMessagePayload;
        if (this.onMessageCallback) {
          this.onMessageCallback(payload);
        }
      } catch (err) {
        console.error('Falha ao processar mensagem P2P:', err);
      }
    };
  }

  private updateStatus(status: string) {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(status);
    }
  }
}
