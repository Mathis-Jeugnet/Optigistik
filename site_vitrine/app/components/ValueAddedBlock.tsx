import React from 'react';

export default function ValueAddedBlock() {
    const benefits = [
        {
            title: 'Gain de temps',
            description: 'Automatisation des processus logistiques.',
        },
        {
            title: 'Réduction des coûts',
            description: 'Moins de carburant, trajets optimisés.',
        },
        {
            title: 'Satisfaction client',
            description: 'Livraisons fiables, suivi transparent.',
        },
        {
            title: 'Engagement écologique',
            description: 'Réduction des émissions et suivi CO₂.',
        },
    ];

    return (
        <section className="w-full bg-[#E5E8EC] dark:bg-zinc-800 py-20 px-6 md:px-16 transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-4">
                <h2 className="text-3xl md:text-4xl font-archivoBlack text-center text-[#0C1D36] dark:text-white mb-16">
                    Valeur ajoutée
                </h2>

                <div className="flex justify-center mb-16">
                    <img
                        src="/assets/solar_graph-up-linear.png"
                        alt="Graph up icon"
                        className="w-12 h-12 dark:invert"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
                    {benefits.map((benefit, index) => (
                        <div key={index} className="flex flex-col items-center p-4">
                            <h3 className="text-lg md:text-xl font-archivoBlack text-[#0C1D36] dark:text-white mb-3">
                                {benefit.title}
                            </h3>
                            <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                                {benefit.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
