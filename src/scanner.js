import { Html5Qrcode } from "html5-qrcode";

export class ScannerManager {
    constructor(readerId, onScan) {
        this.html5QrCode = new Html5Qrcode(readerId);
        this.onScan = onScan;
    }

    async start() {
        try {
            const config = { fps: 10, qrbox: { width: 250, height: 250 } };
            await this.html5QrCode.start(
                { facingMode: "environment" },
                config,
                this.onScan
            );
        } catch (err) {
            console.error("Erro ao iniciar câmera:", err);
            alert("Não foi possível acessar a câmera.");
        }
    }

    async stop() {
        if (this.html5QrCode.isScanning) {
            await this.html5QrCode.stop();
        }
    }
}
