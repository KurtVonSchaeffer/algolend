import{supabase as n}from"./supabaseClient-BXSct5lo.js";/* empty css              *//* empty css               */import{i as o}from"./layout-l3iKOyZ9.js";import{a as s,b as d}from"./utils-CZwHw4kl.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";import"./theme-CYs9TE7o.js";const e=document.getElementById("payments-table-body"),p=a=>{if(e){if(e.innerHTML="",!a||a.length===0){e.innerHTML='<tr><td colspan="5" class="px-6 py-10 text-center text-gray-500">No payment records found.</td></tr>';return}a.forEach(t=>{const r=document.createElement("tr");r.className="hover:bg-gray-50 transition duration-150",r.innerHTML=`
            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">${t.profile?.full_name||"N/A"}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span class="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-green-100 text-green-800">
                    + ${s(t.amount)}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${d(t.payment_date)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">${t.loan_id}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">${t.id}</td>
        `,e.appendChild(r)})}};document.addEventListener("DOMContentLoaded",async()=>{if(await o(),e){const{data:a,error:t}=await n.from("payments").select("*, profile:user_id(full_name)").order("payment_date",{ascending:!1});t?e.innerHTML=`<tr><td colspan="5" class="px-6 py-10 text-center text-red-600">Error fetching payments: ${t.message}</td></tr>`:p(a)}});
