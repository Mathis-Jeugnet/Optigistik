import PricingBlock from "../components/PricingBlock";
import QuoteRequestBlock from "../components/QuoteRequestBlock";

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 pb-20 transition-colors duration-300"> {/* marge sous la navbar fixe */}
            <PricingBlock />
            <div className="max-w-7xl mx-auto px-6 md:px-16">
                <QuoteRequestBlock />
            </div>
        </div>
    );
}