import HeroBlock from "./components/HeroBlock";
import KeyFeaturesBlock from "./components/KeyFeaturesBlock";
import PartnersBlock from "./components/PartnersBlock";
import AiBenefitsBlock from "./components/AiBenefitsBlock";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 transition-colors duration-300">
      <HeroBlock />
      <AiBenefitsBlock />
      <KeyFeaturesBlock />
      <PartnersBlock />
    </div>
  );
}