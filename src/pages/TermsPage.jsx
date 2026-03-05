import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';

const TermsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <Header showStoryDropdown={false} />

      <main className="flex-1 container mx-auto px-4 pt-6 pb-8 bg-black relative z-10">
        <div className="max-w-3xl mx-auto bg-black relative">
          <h1 className="text-2xl font-bold text-white mb-4 pr-8 underline">Disclaimer and Terms of Use</h1>
          <p className="text-gray-300 mb-8">
            The content provided on this website is generated using artificial intelligence and automated data collection technologies. By accessing and using this website, you acknowledge and agree to the following:
          </p>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-3 underline">No Guarantee of Accuracy</h2>
            <p className="text-gray-300">
              The information presented on this site is aggregated, summarized, and processed from multiple third-party news sources using automated tools and artificial intelligence. We make no representations or warranties of any kind, express or implied, regarding the completeness, accuracy, reliability, or suitability of any content displayed on this site. Content is not reviewed, verified, or fact-checked prior to publication.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-3 underline">AI-Generated Summaries and Connected Data</h2>
            <p className="text-gray-300 mb-4">
              This website uses artificial intelligence to generate summaries and connect related data points by amalgamating information from multiple sources.
            </p>
            <p className="text-gray-300">
              These outputs are produced automatically and may contain errors in interpretation, context, emphasis, or factual content. AI-generated content may inadvertently omit key details, misrepresent the meaning or tone of the original reporting, combine information from unrelated stories, incorrectly connect data points, or introduce inaccuracies not present in any individual source.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-3 underline">Third-Party Sources</h2>
            <p className="text-gray-300">
              This website retrieves and processes data from external news outlets and publicly available sources. We are not affiliated with, sponsored by, or endorsed by any of the sources from which data is collected. We do not endorse any of these sources as primary or authoritative sources of information. Any errors, omissions, or inaccuracies present in the original source material may be carried over, altered, or compounded during the automated collection, summarization, and processing of that data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-3 underline">Attribution and Quotation</h2>
            <p className="text-gray-300">
              While our systems attempt to accurately attribute statements, quotations, and reported information to their original sources, automated processing may result in misattributions, incomplete quotations, misquotations, paraphrasing errors, or other inaccuracies in how source material is represented. We do not guarantee that any quotation, excerpt, or summary accurately reflects the content or intent of the original source.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-3 underline">Identification of Persons and Entities</h2>
            <p className="text-gray-300">
              Our automated systems attempt to identify and associate names, organizations, and other personal or entity-level information with relevant data. However, these processes may result in misidentification, incorrect associations, confusion between similarly named individuals or entities, or other errors in linking personal information to the correct source or context.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-3 underline">Connected and Aggregated Data</h2>
            <p className="text-gray-300">
              Where data points are combined, cross-referenced, or presented in relation to one another, additional inaccuracies may arise. Errors may occur in connecting data which create inaccurate associations or improperly connect information to individuals, entities, or events. We do not guarantee the accuracy of any relationships, correlations, trends, or connections drawn between separate pieces of information. Because content is drawn from multiple sources and merged automatically, conflicting information may be presented without distinction or clarification.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-3 underline">No Prior Review or Verification</h2>
            <p className="text-gray-300">
              The content on this website is produced through automated processes and is published without manual review, editorial oversight, or independent verification. It is the responsibility of the viewer to independently research and verify any information found on this site.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-3 underline">Intended Use and Restrictions</h2>
            <p className="text-gray-300">
              The data presented on this website is intended solely as a starting point for further research. This content may not be used for any other purpose. Without limitation, users may not use the information on this site to harass, stalk, threaten, defame, or take any real-world action against or toward any persons, organizations, or entities mentioned in our data. Any misuse of the information provided on this site is strictly prohibited and is the sole responsibility of the user.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-3 underline">Limitation of Liability</h2>
            <p className="text-gray-300">
              To the fullest extent permitted by applicable law, this website, its owners, operators, affiliates, and contributors shall not be held liable for any direct, indirect, incidental, consequential, or punitive damages arising from your use of or reliance on any information presented on this site. This includes, without limitation, damages resulting from inaccuracies, misattributions, misidentifications, misquotations, errors in AI-generated summaries, or errors in aggregated or connected data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-3 underline">Changes to This Disclaimer</h2>
            <p className="text-gray-300">
              We reserve the right to modify this disclaimer at any time without prior notice. Continued use of this website following any changes constitutes acceptance of the revised terms.
            </p>
          </section>

          <div className="mt-8">
            <Link to="/" className="text-gray-300 hover:text-white transition-colors">
              &larr; Back to Graph Explorer
            </Link>
          </div>
        </div>
      </main>

      <footer className="bg-black text-gray-300 py-4 border-t border-[#707070]">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; {new Date().getFullYear()} Graph Explorer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default TermsPage;
