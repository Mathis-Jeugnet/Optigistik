import React from 'react';

export default function SmartOptimizationBlock() {
    const features = [
        {
            title: 'Tableau de bord',
            description: 'Itinéraires, retards/avances, imprévus recalculés automatiquement.',
        },
        {
            title: 'Optimisation IA',
            description: 'Pré-optimisation et réoptimisation instantanée des trajets.',
        },
        {
            title: 'Respect des contraintes',
            description: 'Prise en compte des règles légales et techniques.',
        },
        {
            title: 'Suivi en temps réel',
            description: 'Boîtier connecté : vitesse, carburant, géolocalisation, CO₂.',
        },
    ];

    return (
        <section className="w-full bg-[#E5E8EC] dark:bg-zinc-800 py-20 px-6 md:px-16 transition-colors duration-300">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                {/* Image Section */}
                <div className="flex justify-center lg:justify-start order-last lg:order-first">
                    <img
                        src="/assets/flotteIA.png"
                        alt="Optimisation intelligente des tournées"
                        className="w-full h-auto lg:max-w-none rounded-xl shadow-sm"
                    />
                </div>

                {/* Content Section */}
                <div>
                    <h2 className="text-3xl md:text-4xl font-archivoBlack text-[#0C1D36] dark:text-white mb-8 leading-tight text-center">
                        Optimisation intelligente des tournées
                    </h2>

                    <div className="space-y-8">
                        {features.map((feature, index) => (
                            <div key={index} className="flex flex-col items-center text-center">
                                <h3 className="text-lg md:text-xl font-archivoBlack text-[#0C1D36] dark:text-white mb-2">
                                    {feature.title}
                                </h3>
                                <p className="text-sm md:text-base text-gray-700 dark:text-gray-300">
                                    • {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
