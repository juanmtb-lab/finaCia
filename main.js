class Dashboard {
    constructor() {
        this.data = {
            transactions: [],
            metrics: {},
            history: []
        };
        this.profitChart = null;
        this.isLoading = true;
        this.currentFilter = 'all';
        
        // Security Key (matches n8n)
        this.apiKey = 'finacia_secret_key_2026';
        this.password = 'financia2026'; // Predefined password

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

        // Filtros de tabla
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.renderTable();
            });
        });
    }

    async fetchData() {
        try {
            const response = await fetch('https://n8n.10tacle.app/webhook/finacia-unified-data', {
                headers: {
                    'X-Dashboard-Key': this.apiKey
                }
            });
            if (!response.ok) throw new Error("Acceso denegado o error de servidor");
            
            const result = await response.json();
            
            // Expected payload: { business: { transactions: [...] } }
            if (result && result.business) {
                this.data.transactions = result.business.transactions || [];
                this.calculateMetrics();
                this.isLoading = false;
                this.renderAll();
            } else {
                throw new Error("Formato de datos no válido desde n8n");
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            const tbody = document.querySelector('#transactions-table tbody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--rose);">
                    Error de conexión: ${error.message}. Por favor revisa n8n.
                </td></tr>`;
            }
        }
    }

    calculateMetrics() {
        const t = this.data.transactions;
        // Ordenar por fecha cronológica (assumiendo formato DD/MM/YYYY o similar)
        const sortedTransactions = [...t].sort((a,b) => {
            const dateA = new Date(a.date.split('/').reverse().join('-'));
            const dateB = new Date(b.date.split('/').reverse().join('-'));
            return dateA - dateB;
        });

        let cumulativeSales = 0;
        let cumulativeSpent = 0;
        const roiHistory = [];

        sortedTransactions.forEach(x => {
            if (x.type === 'Venta') {
                cumulativeSales += x.amount;
            } else {
                cumulativeSpent += Math.abs(x.amount);
            }

            // ROI = (Beneficio Neto / Inversión) * 100
            const netProfit = cumulativeSales - cumulativeSpent;
            const currentROI = cumulativeSpent > 0 ? (netProfit / cumulativeSpent) * 100 : 0;
            
            roiHistory.push({
                label: x.date || '-',
                value: currentROI
            });
        });

        const totalSales = t.filter(x => x.type === 'Venta').reduce((acc, curr) => acc + curr.amount, 0);
        const totalPurchases = t.filter(x => x.type === 'Compra').reduce((acc, curr) => acc + curr.amount, 0);
        const totalAds = t.filter(x => x.type === 'Publicidad').reduce((acc, curr) => acc + curr.amount, 0);
        const totalSpent = totalPurchases + totalAds;
        const totalNetProfit = totalSales - totalSpent;
        const finalROI = totalSpent > 0 ? (totalNetProfit / totalSpent) * 100 : 0;

        this.data.metrics = {
            sales: totalSales,
            purchases: totalPurchases,
            ads: totalAds,
            totalSpent: totalSpent,
            netProfit: totalNetProfit,
            roi: finalROI
        };

        this.data.history = roiHistory;
    }

    renderAll() {
        this.renderMetrics();
        this.renderChart();
        this.renderTable();
    }

    renderMetrics() {
        const m = this.data.metrics;
        document.getElementById('net-profit').innerText = `€${m.netProfit.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('roi-value').innerText = `${m.roi.toFixed(1)}%`;
        document.getElementById('total-spent').innerText = `€${m.totalSpent.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

        document.getElementById('summary-value-1').innerText = `€${m.sales.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('summary-value-2').innerText = `€${m.purchases.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('summary-value-3').innerText = `€${m.ads.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    }

    renderChart() {
        const ctx = document.getElementById('profitChart').getContext('2d');
        if (this.profitChart) this.profitChart.destroy();

        const labels = this.data.history.map(h => h.label);
        const values = this.data.history.map(h => h.value);

        // Advanced Gradient for Chart
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
        gradient.addColorStop(1, 'rgba(56, 189, 248, 0)');

        this.profitChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'ROI Acumulado (%)',
                    data: values,
                    borderColor: '#38bdf8',
                    borderWidth: 3,
                    pointBackgroundColor: '#38bdf8',
                    pointBorderColor: 'rgba(255,255,255,0.5)',
                    pointHoverRadius: 6,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.45
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { family: 'Outfit', size: 14 },
                        bodyFont: { family: 'Outfit', size: 13 },
                        padding: 12,
                        cornerRadius: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `ROI: ${context.parsed.y.toFixed(1)}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { color: 'rgba(255,255,255,0.03)' },
                        ticks: { 
                            color: '#94a3b8', 
                            font: { family: 'Outfit' },
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
                    }
                }
            }
        });
    }

    renderTable() {
        const tbody = document.querySelector('#transactions-table tbody');
        if (!tbody) return;

        const filtered = this.currentFilter === 'all' 
            ? this.data.transactions 
            : this.data.transactions.filter(t => t.type === this.currentFilter);

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">No hay transacciones registradas.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(t => {
            const isNegative = t.type === 'Compra' || t.type === 'Publicidad';
            return `
                <tr>
                    <td>${t.date || '-'}</td>
                    <td>${t.item || '-'}</td>
                    <td><span class="type-tag ${this.getTypeClass(t.type)}">${t.type}</span></td>
                    <td style="color: ${isNegative ? 'var(--rose)' : 'var(--emerald)'}">
                        ${isNegative ? '-' : '+'}${Math.abs(t.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                    </td>
                </tr>
            `;
        }).join('');
    }

    getTypeClass(type) {
        switch(type) {
            case 'Venta': return 'emerald-tag';
            case 'Compra': return 'rose-tag';
            case 'Publicidad': return 'indigo-tag';
            default: return '';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});
