import { request, APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Utility to fetch data from an external API.
 */
export class ExternalApiService {
    private baseUrl: string;
    private token: string;

    constructor() {
        this.baseUrl = process.env.EXTERNAL_API_URL || '';
        this.token = process.env.EXTERNAL_API_TOKEN || '';
    }

    /**
     * Fetches data from a specific endpoint.
     * @param endpoint The API endpoint (e.g., '/orders/123')
     * @returns The JSON response data
     */
    async fetchData(endpoint: string) {
        if (!this.baseUrl) {
            throw new Error('EXTERNAL_API_URL is not defined in .env');
        }

        const context: APIRequestContext = await request.newContext();

        const response = await context.get(`${this.baseUrl}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json',
            }
        });

        if (!response.ok()) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch data from API: ${response.status()} ${response.statusText()} - ${errorText}`);
        }

        const data = await response.json();
        return data;
    }

    /**
     * Fetches invoice details from BiofuelCircle API.
     * @param deliveryId The delivery ID (e.g., '105302')
     */
    async getInvoiceDetails(deliveryId: string) {
        // Construct the specific URL with the delivery ID and required fields
        const endpoint = `/invoice?invoice_cashflow__delivery=${deliveryId}&fields=invoice_number,presigned_url,type,created_at&type=22&cashflow_category=3860`;

        const response = await this.fetchData(endpoint);

        if (response.status === 'success' && response.data?.results?.length > 0) {
            const results = response.data.results;
            console.log(`[API] Found ${results.length} invoice(s) for Delivery ID ${deliveryId}. Using the first one.`);

            const latestResult = results[0];
            console.log(`[API] Selected Invoice: No=${latestResult.invoice_number}, Type=${latestResult.type}, Created=${latestResult.created_at}`);

            return {
                invoiceNumber: latestResult.invoice_number,
                date: latestResult.created_at.split('T')[0], // Only the date part
                amount: response.data.total_amount,
                url: latestResult.presigned_url
            };
        }

        throw new Error(`No invoice data found for Delivery ID: ${deliveryId}`);
    }

    /**
     * Fetches delivery details, converts quantity to MT, and identifies specific media.
     * @param deliveryId The delivery ID (e.g., '105302')
     */
    async getDeliveryDetails(deliveryId: string) {
        // Construct the specific URL for delivery details
        const endpoint = `/delivery/${deliveryId}?fields=delivery_media,delivery_id,quantity&delivery_media__measured_at=3870`;

        const response = await this.fetchData(endpoint);

        if (response.status === 'success' && response.data) {
            const quantityKg = parseFloat(response.data.quantity);
            const quantityMt = quantityKg / 1000;

            // Find media where measured_at is 3871 (consistent with the query parameter)
            const targetMedia = response.data.delivery_media?.find((m: any) => m.measured_at === 3870);

            return {
                quantityMt: quantityMt,
                url: targetMedia?.presigned_url,
                displayFileName: targetMedia?.display_file_name
            };
        }

        throw new Error(`Failed to fetch delivery details for Delivery ID: ${deliveryId}`);
    }

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
