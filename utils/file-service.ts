import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Utility to fetch data from an external API.
 */
export class FileService {

    async downloadFile(url: string, fileName: string, targetFolder: string = 'data/docs') {
        console.log(`[FileService] Downloading: ${fileName}...`);

        // Ensure the target directory exists
        const absoluteFolderPath = path.resolve(process.cwd(), targetFolder);
        if (!fs.existsSync(absoluteFolderPath)) {
            fs.mkdirSync(absoluteFolderPath, { recursive: true });
        }

        const filePath = path.join(absoluteFolderPath, fileName);

        try {
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            fs.writeFileSync(filePath, response.data);
            console.log(`[FileService] Successfully saved to: ${filePath}`);
            return filePath;
        } catch (error: any) {
            const status = error.response?.status || 'Unknown';
            const statusText = error.response?.statusText || error.message;
            console.error(`[FileService] Failed to download from URL. Status: ${status}`);
            throw new Error(`Failed to download file: ${status} ${statusText}`);
        }
    }
}
