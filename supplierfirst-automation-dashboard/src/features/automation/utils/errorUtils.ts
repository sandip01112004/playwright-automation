/**
 * Maps technical API error responses and status codes to user-friendly messages.
 */
export const getFriendlyErrorMessage = (error: any): string => {
    // 1. Check for Network Errors (No response from server)
    if (error.message === 'Network Error' || !error.response) {
        return 'Unable to connect to the BiofuelCircle server. Please check your internet connection and try again.';
    }

    const status = error.response.status;
    const apiMessage = error.response.data?.message || '';

    // 2. Map Specific Status Codes
    switch (status) {
        case 401:
            return 'Your session has expired. Please retry the automation or log in to BiofuelCircle again.';
        case 403:
            return 'You do not have permission to access this automation task. Please check your credentials.';
        case 404:
            return 'The requested automation task could not be found. It may have been deleted or the link is incorrect.';
        case 429:
            return 'Too many requests. Please wait a moment before trying again.';
        case 500:
        case 502:
        case 503:
        case 504:
            return 'The BiofuelCircle system is currently experiencing technical difficulties. Please try again in 5-10 minutes.';
    }

    // 3. Map specific API message strings (if any)
    if (apiMessage.includes('OTP_EXPIRED')) {
        return 'The OTP has expired. Please restart the automation process.';
    }

    if (apiMessage.includes('LIMIT_EXCEEDED')) {
        return 'You have exceeded the maximum number of attempts. Please try again later.';
    }

    // 4. Fallback to raw message if present, or generic text
    return apiMessage || error.message || 'An unexpected error occurred during the automation process. Please refresh and try again.';
};
