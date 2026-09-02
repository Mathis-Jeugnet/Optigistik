export default function AiBenefitsBlock() {
  const benefits = [
    {
      title: "Améliore la productivité",
      text: "Planification intelligente des itinéraires et affectations automatiques."
    },
    {
      title: "Respecte les règles",
      text: "Pause obligatoire, contraintes horaires et réglementaires toujours intégrées."
    },
    {
      title: "Anticipe les imprévus",
      text: "Recalcul instantané des trajets en cas d’accident, retard ou détour."
    },
    {
      title: "Optimise vos coûts",
      text: "Analyse en temps réel de la consommation, des émissions et des délais pour réduire vos dépenses."
    },
  ];

  return (
    <section className="w-full bg-white dark:bg-zinc-900 py-20 px-6 md:px-16 transition-colors duration-300">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

        {/* IMAGE */}
        <div className="order-1 lg:order-none">
          <img
            src="/assets/AiTrucks.png"
            alt="Camions et itinéraires optimisés par l’IA"
            className="w-full h-auto rounded-2xl shadow-sm object-cover"
          />
        </div>

        {/* TEXT + COLUMNS */}
        <div className="text-center lg:text-left">
          <h2 className="text-3xl md:text-4xl font-archivoBlack text-[#0C1D36] dark:text-white mb-8">
            Un logiciel boosté par l’IA
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {benefits.map((item) => (
              <div key={item.title} className="flex flex-col items-center lg:items-start">
                <h3 className="text-lg md:text-xl font-archivoBlack text-[#0C1D36] dark:text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-sm md:text-base text-gray-700 dark:text-gray-300">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}