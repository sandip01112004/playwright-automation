export type AutomationStatus =
    | 'idle'
    | 'processing'
    | 'awaiting_otp'
    | 'otp_provided'
    | 'completed'
    | 'failed'
    | number;

export interface TaskData {
    id: number;
    status: AutomationStatus;
    otp?: string;
    error_message?: string | null;
    task_type?: number;
    created_by?: number;
    updated_by?: number;
    created_at?: string;
    updated_at?: string;
}

export interface LookupData {
    id: number;
    name: string;
    value: string;
    category: string;
}

export interface AutomationState {
    task: TaskData | null;
    lookupData: LookupData[];
    loading: boolean;
    error: string | null;
}
