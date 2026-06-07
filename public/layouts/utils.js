export const formatCurrency = (amount) => {
    const num = Number(amount);
    if (isNaN(num)) return 'ZAR 0.00';
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(num);
};

export const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};
