import { request, APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Utility to fetch data from an external API.
 */
export class ExternalApiService {

    /**
     * Downloads a file from a URL and saves it to a local directory.
     * @param url The public/presigned URL of the file
     * @param fileName The name to save the file as (e.g., 'invoice_123.pdf')
     * @param targetFolder The local folder to save the file in (defaults to 'docs')
     */
    async downloadFile(url: string, fileName: string, targetFolder: string = 'docs') {
        const context: APIRequestContext = await request.newContext();

        // Ensure the target directory exists
        const absoluteFolderPath = path.resolve(process.cwd(), targetFolder);
        if (!fs.existsSync(absoluteFolderPath)) {
            fs.mkdirSync(absoluteFolderPath, { recursive: true });
        }

        const filePath = path.join(absoluteFolderPath, fileName);

        const response = await context.get(url);

        if (!response.ok()) {
            throw new Error(`Failed to download file: ${response.status()} ${response.statusText()}`);
        }

        const buffer = await response.body();
        fs.writeFileSync(filePath, buffer);

        return filePath;
    }
}
