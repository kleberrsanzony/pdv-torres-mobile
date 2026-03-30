export class CartManager {
    constructor(items = []) {
        this.items = items;
        this.manualAdjustment = 0;
        this.onUpdate = null;
    }

    loadItems(items) {
        this.items = items || [];
        this.notify();
    }

    addItem(product, quantity, discountVal = 0, discountPct = 0) {
        const item = {
            id: Date.now(),
            code: product.code,
            name: product.name,
            price: parseFloat(product.price),
            quantity: parseFloat(quantity),
            discountVal: parseFloat(discountVal),
            discountPct: parseFloat(discountPct),
            totalFinal: 0
        };

        this.calculateItemTotal(item);
        this.items.push(item);
        this.notify();
    }

    updateItem(id, quantity, discountVal = 0, discountPct = 0) {
        const itemIndex = this.items.findIndex(i => i.id === id);
        if (itemIndex > -1) {
            const item = this.items[itemIndex];
            item.quantity = parseFloat(quantity);
            item.discountVal = parseFloat(discountVal);
            item.discountPct = parseFloat(discountPct);
            
            this.calculateItemTotal(item);
            this.notify();
        }
    }

    calculateItemTotal(item) {
        const gross = item.price * item.quantity;
        // Rules: If discountPct is provided, it takes precedence or they are synced?
        // User said: "Se editar R$, recalcular %. Se editar %, recalcular R$. Nunca aplicar ambos juntos duplicados."
        // During insertion we sync them. Here we just use what's stored.
        
        // Ensure discount doesn't exceed gross
        if (item.discountVal > gross) item.discountVal = gross;
        
        item.totalFinal = gross - item.discountVal;
    }

    removeItem(id) {
        this.items = this.items.filter(item => item.id !== id);
        this.notify();
    }

    getTotals() {
        const totals = this.items.reduce((acc, item) => {
            const gross = item.price * item.quantity;
            acc.gross += gross;
            acc.discount += item.discountVal;
            acc.final += item.totalFinal;
            return acc;
        }, { gross: 0, discount: 0, final: 0 });

        // Apply global manual adjustment (rounding)
        totals.final -= this.manualAdjustment;
        
        return totals;
    }

    setManualAdjustment(adjustment) {
        this.manualAdjustment = parseFloat(adjustment) || 0;
        this.notify();
    }

    clear() {
        this.items = [];
        this.manualAdjustment = 0;
        this.notify();
    }

    notify() {
        if (this.onUpdate) this.onUpdate(this.items, this.getTotals());
    }
}

export function syncDiscounts(price, quantity, source, value) {
    const gross = price * quantity;
    if (gross <= 0) return { val: 0, pct: 0 };

    let val = 0;
    let pct = 0;

    if (source === 'val') {
        val = Math.min(parseFloat(value) || 0, gross);
        pct = (val / gross) * 100;
    } else {
        pct = Math.min(parseFloat(value) || 0, 100);
        val = (pct / 100) * gross;
    }

    return {
        val: parseFloat(val.toFixed(2)),
        pct: parseFloat(pct.toFixed(2))
    };
}
