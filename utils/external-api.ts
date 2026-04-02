import axios from 'axios';
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
     * @param targetFolder The local folder to save the file in (defaults to 'data/docs')
     */
    async downloadFile(url: string, fileName: string, targetFolder: string = 'data/docs') {
        console.log(`[ExternalApiService] Downloading: ${fileName} from ${url.substring(0, 50)}...`);

        // Ensure the target directory exists
        const absoluteFolderPath = path.resolve(process.cwd(), targetFolder);
        if (!fs.existsSync(absoluteFolderPath)) {
            fs.mkdirSync(absoluteFolderPath, { recursive: true });
        }

        const filePath = path.join(absoluteFolderPath, fileName);

        try {
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            fs.writeFileSync(filePath, response.data);
            console.log(`[ExternalApiService] Successfully saved to: ${filePath}`);
            return filePath;
        } catch (error: any) {
            const status = error.response?.status || 'Unknown';
            const statusText = error.response?.statusText || error.message;
            console.error(`[ExternalApiService] Failed to download from ${url}: ${status} ${statusText}`);
            throw new Error(`Failed to download file: ${status} ${statusText}`);
        }
    }
}
