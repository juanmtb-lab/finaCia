class Dashboard {
    constructor() {
        this.data = {
            business: { transactions: [], metrics: {}, history: [] }
        };
        this.charts = {
            profit: null,
            distribution: null
        };
        this.isLoading = true;
        this.currentFilter = 'all';
        
        // Security Key (matches n8n)
        this.apiKey = 'finacia_secret_key_2026';
        this.password = 'financia2026';

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.checkAuth();
    }

    checkAuth() {
        const isAuth = localStorage.getItem('FinancIA_Auth_v3') === 'true';
        if (isAuth) {
            document.getElementById('login-overlay').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            this.fetchData();
        }
    }

    setupEventListeners() {
        // Login Logic
        const loginBtn = document.getElementById('login-btn');
        const passInput = document.getElementById('dashboard-pass');
        
        const handleLogin = () => {
            if (passInput.value === this.password) {
                localStorage.setItem('FinancIA_Auth_v3', 'true');
                document.getElementById('login-overlay').classList.add('hidden');
                document.getElementById('app').classList.remove('hidden');
                this.fetchData();
            } else {
                document.getElementById('login-error').classList.remove('hidden');
            }
        };

        loginBtn?.addEventListener('click', handleLogin);
        passInput?.addEventListener('keypress', (e) => { if(e.key === 'Enter') handleLogin(); });

        // Filtros de tabla Negocio
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.renderBusinessTable();
            });
        });
    }



    async fetchData() {
        try {
            const resp = await fetch('https://n8n.10tacle.app/webhook/finacia-unified-data', {
                headers: { 'X-Dashboard-Key': this.apiKey }
            });
            const result = await resp.json();
            
            if (result && result.business) {
                // Autocorrect logic for stale n8n mappers
                this.data.business.transactions = (result.business.transactions || []).map(t => {
                    let type = t.type;
                    const concept = (t.item || '').toUpperCase();
                    if (type === 'Venta') {
                        if (concept.includes('ENVIO') || concept.includes('ENVÍO')) type = 'Envío';
                        else if (concept.includes('DEVOLUCION') || concept.includes('DEVOLUCIÓN')) {
                            if (concept.includes('FAVOR')) type = 'Devolución a favor';
                            else type = 'Devolución en contra';
                        }
                    }
                    return { ...t, type };
                });
                this.calculateBusinessMetrics();
            }
            
            this.isLoading = false;
            this.renderAll();
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    }



    calculateBusinessMetrics() {
        const t = this.data.business.transactions;
        if (!t || t.length === 0) return;

        const monthlyMap = {};
        const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

        // Sorting by date
        const sorted = [...t].sort((a,b) => {
            const [dA, mA, yA] = a.date.split('/');
            const [dB, mB, yB] = b.date.split('/');
            return new Date(yA, mA-1, dA) - new Date(yB, mB-1, dB);
        });

        // Per-item cost map for profit calculation
        this.data.business.costMap = {};
        t.filter(x => x.type === 'Compra').forEach(c => {
            this.data.business.costMap[c.item.toLowerCase()] = c.amount;
        });

        sorted.forEach(x => {
            const [d, m, y] = x.date.split('/');
            const key = `${y}-${m.padStart(2, '0')}`;
            if (!monthlyMap[key]) {
                const monthName = monthNames[parseInt(m)-1];
                monthlyMap[key] = { label: `${monthName} ${y.slice(-2)}`, value: 0 };
            }

            const type = x.type;
            if (type === 'Venta') {
                monthlyMap[key].value += x.amount;
            } else if (type === 'Compra' || type === 'Publicidad' || type === 'Envío') {
                monthlyMap[key].value -= Math.abs(x.amount);
            } else if (type === 'Devolución a favor') {
                monthlyMap[key].value += Math.abs(x.amount);
            } else if (type === 'Devolución en contra') {
                monthlyMap[key].value -= Math.abs(x.amount);
            }
        });

        const totalSales = t.filter(x => x.type === 'Venta').reduce((acc, curr) => acc + curr.amount, 0);
        const totalPurchases = t.filter(x => x.type === 'Compra').reduce((acc, curr) => acc + curr.amount, 0);
        const totalAds = t.filter(x => x.type === 'Publicidad').reduce((acc, curr) => acc + curr.amount, 0);
        const totalShipping = t.filter(x => x.type === 'Envío').reduce((acc, curr) => acc + curr.amount, 0);
        const totalReturnsPos = t.filter(x => x.type === 'Devolución a favor').reduce((acc, curr) => acc + curr.amount, 0);
        const totalReturnsNeg = t.filter(x => x.type === 'Devolución en contra').reduce((acc, curr) => acc + curr.amount, 0);

        const totalSpent = totalPurchases + totalAds + totalShipping + totalReturnsNeg;
        const totalNetProfit = (totalSales + totalReturnsPos) - totalSpent;

        this.data.business.metrics = {
            sales: totalSales, purchases: totalPurchases, ads: totalAds,
            totalSpent: totalSpent, netProfit: totalNetProfit,
            roi: totalSpent > 0 ? (totalNetProfit / totalSpent) * 100 : 0
        };
        this.data.business.history = Object.keys(monthlyMap).sort().map(k => monthlyMap[k]);
    }

    renderAll() {
        this.renderBusinessMetrics();
        this.renderBusinessCharts();
        this.renderBusinessTable();
    }

    renderBusinessMetrics() {
        const m = this.data.business.metrics;
        if (!m || !m.sales) return;
        document.getElementById('net-profit').innerText = `€${m.netProfit.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('roi-value').innerText = `${m.roi.toFixed(1)}%`;
        document.getElementById('total-spent').innerText = `€${m.totalSpent.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('summary-value-1').innerText = `€${m.sales.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('summary-value-2').innerText = `€${m.purchases.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('summary-value-3').innerText = `€${m.ads.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    }



    renderBusinessCharts() {
        // Profit Line Chart (Smoothing requested)
        const ctxProfit = document.getElementById('profitChart').getContext('2d');
        if (this.charts.profit) this.charts.profit.destroy();
        this.charts.profit = new Chart(ctxProfit, {
            type: 'line',
            data: {
                labels: this.data.business.history.map(h => h.label),
                datasets: [{
                    label: 'Beneficio',
                    data: this.data.business.history.map(h => h.value),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#10b981'
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });

        // Distribution Doughnut
        const ctxDist = document.getElementById('distributionChart').getContext('2d');
        if (this.charts.distribution) this.charts.distribution.destroy();
        this.charts.distribution = new Chart(ctxDist, {
            type: 'doughnut',
            data: {
                labels: ['Ventas', 'Gastos/Inversión'],
                datasets: [{
                    data: [this.data.business.metrics.sales, this.data.business.metrics.totalSpent],
                    backgroundColor: ['rgba(56, 189, 248, 0.7)', 'rgba(244, 63, 94, 0.7)'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom' } } }
        });
    }



    renderBusinessTable() {
        const tbody = document.querySelector('#transactions-table tbody');
        if (!tbody) return;
        const filtered = this.currentFilter === 'all' ? this.data.business.transactions : (
            this.currentFilter === 'Devolución' ? this.data.business.transactions.filter(t => t.type.includes('Devolución')) : 
            this.data.business.transactions.filter(t => t.type === this.currentFilter)
        );
        
        tbody.innerHTML = filtered.map(t => {
            let profitVal = 0;
            if (t.type === 'Venta') {
                const cost = this.data.business.costMap[t.item.toLowerCase()] || 0;
                profitVal = t.amount - cost;
            } else if (t.type === 'Devolución a favor') {
                profitVal = t.amount;
            } else {
                // Compra, Publicidad, Envío, Devolución en contra are costs
                profitVal = -Math.abs(t.amount);
            }
            
            const profitStr = (profitVal >= 0 ? '+' : '-') + Math.abs(profitVal).toLocaleString('es-ES', { minimumFractionDigits: 2 }) + '€';
            const profitColor = profitVal >= 0 ? 'var(--emerald)' : 'var(--rose)';
            
            return `
                <tr>
                    <td>${t.date}</td>
                    <td>${t.item}</td>
                    <td><span class="type-tag ${this.getTypeClass(t.type)}">${t.type}</span></td>
                    <td style="color: ${this.isNegative(t.type)?'var(--rose)':'var(--emerald)'}">
                        ${this.isNegative(t.type)?'-':'+'}${Math.abs(t.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                    </td>
                    <td style="font-weight: 600; color: ${profitColor}">${profitStr}</td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="5" style="text-align: center;">Sin transacciones</td></tr>';
    }

    isNegative(type) {
        const t = (type || '').toUpperCase();
        return t.includes('COMPRA') || t.includes('PUBLICIDAD') || t.includes('ADS') || t.includes('ENVI') || t.includes('CONTRA');
    }

    getTypeClass(type) {
        const t = (type || '').toUpperCase();
        if (t.includes('VENTA')) return 'emerald-tag';
        if (t.includes('COMPRA')) return 'rose-tag';
        if (t.includes('PUBLICIDAD') || t.includes('ADS')) return 'indigo-tag';
        if (t.includes('ENVI') || t.includes('SHIPPING')) return 'shipping-tag';
        if (t.includes('DEVOL') && t.includes('FAVOR')) return 'dev-favor-tag';
        if (t.includes('DEVOL') && (t.includes('CONTRA') || !t.includes('FAVOR'))) return 'dev-contra-tag';
        return '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});
