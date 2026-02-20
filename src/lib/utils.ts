export const formatAppId = (appId: string | null | undefined) => {
    return (appId || 'Unknown App')
        .replace(/^2h_/, '')
        .replace(/_v\d+$/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
};
