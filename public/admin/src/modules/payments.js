import { initLayout } from '../shared/layout.js';
import { supabase } from '../services/supabaseClient.js';
import { formatCurrency, formatDate } from '../shared/utils.js';

const tableBody = document.getElementById('payments-table-body');

const renderPayments = (payments) => {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!payments || payments.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-gray-500">No payment records found.</td></tr>`;
        return;
    }

    payments.forEach(payment => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition duration-150';

        // STYLING UPDATE: Replaced plain text with styled badges for amounts and bolded names.
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">${payment.profile?.full_name || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span class="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-green-100 text-green-800">
                    + ${formatCurrency(payment.amount)}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${formatDate(payment.payment_date)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">${payment.loan_id}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">${payment.id}</td>
        `;
        tableBody.appendChild(row);
    });
};

document.addEventListener('DOMContentLoaded', async () => {
    await initLayout();

    if (tableBody) {
        const { data, error } = await supabase
            .from('payments')
            .select('*, profile:user_id(full_name)')
            .order('payment_date', { ascending: false });

        if (error) {
            tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-red-600">Error fetching payments: ${error.message}</td></tr>`;
        } else {
            renderPayments(data);
        }
    }
});