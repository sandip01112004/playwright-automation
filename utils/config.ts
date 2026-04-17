import * as dotenv from 'dotenv';
import * as path from 'path';

// Ensure .env is loaded from the root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Centralized configuration for the automation system.
 * Throws early if required environment variables are missing.
 */
class Config {
    constructor() {
        this.refresh();
        this.validate();
    }

    refresh() {
        dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
    }

    private validate() {
        const required = [
            'SUPPLIER_NAME', 'SUPPLIER_ID', 'TARGET_SYSTEM_ID',
            'BASE_URL', 'REACT_APP_biofuelcircle_API_BASE_URL', 'REACT_APP_biofuelcircle_API_TOKEN',
            'REACT_APP_SCN_API_SECRET_KEY', 'OTP_CHANNEL',
            'TRIGGER_API_PORT', 'WAIT_TIMEOUT', 'REACT_APP_POLL_INTERVAL', 'DEFAULT_TRANSPORTER'
        ];
        const missing = required.filter(key => !process.env[key]);
        if (missing.length > 0) {
            throw new Error(`[Config Failure] Missing required environment variables: ${missing.join(', ')}. Please check your .env file.`);
        }
    }

    private getRequiredEnv(key: string): string {
        const value = process.env[key];
        if (!value) throw new Error(`[Config Failure] Missing required environment variable: ${key}`);
        return value;
    }

    get SUPPLIER_NAME() { return this.getRequiredEnv('SUPPLIER_NAME'); }
    get SUPPLIER_ID() { return this.getRequiredEnv('SUPPLIER_ID'); }
    get TARGET_SYSTEM_ID() { return Number(this.getRequiredEnv('TARGET_SYSTEM_ID')); }
    get BASE_URL() { return this.getRequiredEnv('BASE_URL'); }
    get BFC_API_URL() { return this.getRequiredEnv('REACT_APP_biofuelcircle_API_BASE_URL'); }
    get BFC_API_TOKEN() { return this.getRequiredEnv('REACT_APP_biofuelcircle_API_TOKEN'); }
    get SCN_API_SECRET_KEY() { return this.getRequiredEnv('REACT_APP_SCN_API_SECRET_KEY'); }
    get OTP_CHANNEL() { return this.getRequiredEnv('OTP_CHANNEL'); }
    get TRIGGER_API_PORT() { return Number(this.getRequiredEnv('TRIGGER_API_PORT')); }
    get WAIT_TIMEOUT() { return Number(this.getRequiredEnv('WAIT_TIMEOUT')); }
    get POLL_INTERVAL() { return Number(this.getRequiredEnv('REACT_APP_POLL_INTERVAL')); }
    get DEFAULT_TRANSPORTER() { return this.getRequiredEnv('DEFAULT_TRANSPORTER'); }
}

export const config = new Config();
