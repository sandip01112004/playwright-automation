import * as dotenv from 'dotenv';
import * as path from 'path';

// Ensure .env is loaded
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Centralized configuration for the automation system.
 */
class Config {
    constructor() {
        this.refresh();
    }

    refresh() {
        dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
    }

    get SUPPLIER_NAME() { return process.env.SUPPLIER_NAME || ''; }
    get SUPPLIER_ID() { return process.env.SUPPLIER_ID || ''; }
    get TARGET_SYSTEM_ID() { return Number(process.env.TARGET_SYSTEM_ID); }
    get BASE_URL() { return process.env.BASE_URL || ''; }
    get BFC_API_URL() { return process.env.BFC_API_URL || ''; }
    get BFC_API_TOKEN() {
        // Enforced Strategy: Dynamically provided by the Trigger API worker environment.
        // No fallback to process.env.BFC_API_TOKEN from .env is allowed here.
        return process.env.BFC_API_TOKEN || '';
    }
}

export const config = new Config();
