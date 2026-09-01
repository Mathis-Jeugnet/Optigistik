import FeaturesBannerBlock from "../components/FeaturesBannerBlock";
import RealTimeTrackingBlock from "../components/RealTimeTrackingBlock";
import OperationalManagementBlock from "../components/OperationalManagementBlock";
import SmartOptimizationBlock from "../components/SmartOptimizationBlock";
import ValueAddedBlock from "../components/ValueAddedBlock";

export default function FeaturesPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 transition-colors duration-300">
            <FeaturesBannerBlock />
            <OperationalManagementBlock />
            <SmartOptimizationBlock />
            <RealTimeTrackingBlock />
            <ValueAddedBlock />
        </div>
    );
}
