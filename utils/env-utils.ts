import * as fs from 'fs';
import * as path from 'path';

/**
 * Safely updates keys in the .env file.
 * If a key exists, it updates its value.
 * If it doesn't exist, it appends it.
 */
export function updateEnv(updates: Record<string, string>) {
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }

    const lines = envContent.split('\n');
    const updatedKeys = new Set<string>();

    const newLines = lines.map(line => {
        // Handle empty lines or comments
        if (!line.trim() || line.startsWith('#')) return line;

        const parts = line.split('=');
        if (parts.length < 2) return line;

        const key = parts[0]!.trim();
        if (updates[key] !== undefined) {
            updatedKeys.add(key);
            return `${key}=${updates[key]}`;
        }
        return line;
    });

    Object.keys(updates).forEach(key => {
        if (!updatedKeys.has(key)) {
            newLines.push(`${key}=${updates[key]}`);
        }
    });

    fs.writeFileSync(envPath, newLines.join('\n').trim() + '\n');
    console.log(`.env file updated successfully with: ${Object.keys(updates).join(', ')}`);
}
