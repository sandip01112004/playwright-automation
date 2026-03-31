export type AutomationStatus =
    | 'idle'
    | 1296 // processing
    | 1297 // awaiting_otp
    | 1298 // otp_provided
    | 1299 // completed
    | 1300; // failed

export interface TaskData {
    id: number;
    status: AutomationStatus;
    scn?: string;
    message?: string;
    otp?: string;
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
