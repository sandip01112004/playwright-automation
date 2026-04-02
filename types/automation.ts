export interface DeliveryMedia {
    id: number;
    file_name: string;
    display_file_name: string;
    presigned_url: string;
    media_type: number;
    orientation: number;
    measured_at: number;
    created_at: string;
    updated_at: string;
}

export interface Delivery {
    quantity: string;
    delivery_media: DeliveryMedia[];
}

export interface InvoiceType {
    id: number;
    name: string;
    sequence_id: number;
    category: string;
    display_name: string;
}

export interface Invoice {
    type: InvoiceType;
    presigned_url: string;
    created_at: string;
    invoice_number: string;
    total_amount: string;
}

export interface AutomationPayload {
    task_id: number;
    order_id: number;
    delivery: Delivery;
    invoice: Invoice;
}
