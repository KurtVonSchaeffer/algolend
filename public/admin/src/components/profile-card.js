/**
 * Institutional Profile Card - Professional Energy Design
 * Designed for Zwane Finance SACRRA Compliance
 */

export function renderProfileCard(profile, options = {}) {
    const { 
        showActions = true, 
        className = "", 
        isLuhnValid = true 
    } = options;

    // Handle Split Name Logic
    let displayName = profile.full_name || (profile.first_name + ' ' + profile.surname);
    displayName = displayName.replace('NOT_PROVIDED', '').trim();
    
    const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    
    const statusColor = isLuhnValid ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100';
    const statusIcon = isLuhnValid ? 'check_circle' : 'warning';
    const statusText = isLuhnValid ? 'Verified ID' : 'ID Error';

    return `
        <div class="bg-white rounded-[32px] border border-slate-200/60 shadow-sm overflow-hidden relative group transition-all hover:shadow-xl hover:shadow-slate-200/40 ${className}">
            <!-- Brand Accent -->
            <div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#7C3AED] to-[#5B21B6]"></div>
            
            <div class="p-8">
                <div class="flex items-start justify-between mb-8">
                    <div class="flex items-center gap-5">
                        <div class="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xl font-black text-slate-400 shadow-inner group-hover:scale-105 transition-transform">
                            ${initials || 'U'}
                        </div>
                        <div>
                            <h3 class="text-xl font-black text-slate-900 tracking-tight leading-none">${displayName || 'Unknown Client'}</h3>
                            <div class="flex items-center gap-2 mt-2">
                                <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">${profile.role || 'CLIENT'}</span>
                                <span class="w-1 h-1 rounded-full bg-slate-300"></span>
                                <span class="text-[10px] font-bold text-slate-500">${profile.branches?.name || 'Unassigned'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="px-3 py-1.5 rounded-xl border ${statusColor} flex items-center gap-2 animate-pulse-slow">
                        <span class="material-symbols-outlined text-[14px]">${statusIcon}</span>
                        <span class="text-[10px] font-black uppercase tracking-widest">${statusText}</span>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4 mb-8">
                    <div class="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                        <p class="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Identity Number</p>
                        <p class="text-xs font-bold text-slate-700 font-mono">${profile.identity_number || profile.id_number || '---'}</p>
                    </div>
                    <div class="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                        <p class="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">System UUID</p>
                        <p class="text-[10px] font-bold text-slate-500 font-mono truncate">${profile.id.substring(0, 13)}...</p>
                    </div>
                </div>

                <div class="space-y-3">
                    <div class="flex items-center gap-3 text-slate-600">
                        <span class="material-symbols-outlined text-[18px] text-slate-400">mail</span>
                        <span class="text-xs font-bold truncate">${profile.email || 'No email provided'}</span>
                    </div>
                    <div class="flex items-center gap-3 text-slate-600">
                        <span class="material-symbols-outlined text-[18px] text-slate-400">call</span>
                        <span class="text-xs font-bold">${profile.contact_number || profile.phone_mobile || 'No contact'}</span>
                    </div>
                </div>

                ${showActions ? `
                <div class="mt-8 pt-8 border-t border-slate-50 flex gap-3">
                    <button onclick="window.openUserDetail('${profile.id}')" class="flex-1 py-3 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-slate-900/20 hover:bg-black transition-all">View Details</button>
                    <button class="w-12 h-12 flex items-center justify-center border border-slate-200 rounded-xl text-slate-400 hover:text-[#7C3AED] hover:border-[#7C3AED] transition-all">
                        <span class="material-symbols-outlined">edit</span>
                    </button>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}
