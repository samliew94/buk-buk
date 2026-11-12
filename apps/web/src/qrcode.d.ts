declare module 'qrcode' {
	interface QRCodeOptions {
		errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
		margin?: number;
		width?: number;
	}

	interface QRCode {
		toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
	}

	const QRCode: QRCode;
	export default QRCode;
}
