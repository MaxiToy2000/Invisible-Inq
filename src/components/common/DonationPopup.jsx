import React from 'react';
import { FaTimes } from 'react-icons/fa';
import EditableContent from './EditableContent';

const DonationPopup = ({ onClose }) => {
  const defaultTitle = 'Your support is crucial!';
  const defaultIntro = `My goals were big — expose the world's best-kept secrets and create the
world's most compelling data-driven presentations. In my first few months,
I tackled investigations too big for any other format.`;

  const defaultHighlights = `<p class="font-bold text-center text-xs sm:text-sm">-The Soros dark money trail</p>
<p class="font-bold text-center text-xs sm:text-sm">-USAID funding Wuhan Labs and Hunter Biden Ukraine Biolabs</p>
<p class="font-bold text-center text-xs sm:text-sm">-Planned Parenthood, Military Industrial Complex and the USAID global depopulation engine.</p>`;

  const defaultTagline = `You can't find these stories anywhere else!`;

  const defaultMiddle = `I made a promise to share my findings with the public. But when I was
locked out of my account by a hosting company, building my own app
became a necessity. My goals are now even bigger: Create public
intelligence tools that revolutionize how the world understands itself.`;

  const defaultClosing = `I'm pouring everything I have into this and to take it any further I need
your help. If you've found value in my work, I humbly request your financial
support, in an amount you feel is fair. You'll not only support my past work,
but also my future projects. The truth is at our fingertips.`;

  const defaultQuestion = 'Can I count on you to take this journey with me?';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-black border border-[#707070] p-4 sm:p-6 md:p-8 lg:p-8 rounded-lg shadow-lg w-full max-w-xs sm:max-w-md md:max-w-lg lg:max-w-2xl text-white overflow-y-auto max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
        {}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 text-[#B4B4B4] hover:text-white transition-colors p-1 z-10"
          title="Close"
          aria-label="Close popup"
        >
          <FaTimes size={20} />
        </button>
        <div className="relative group mb-2 sm:mb-3 lg:mb-4">
          <EditableContent
            content={defaultTitle}
            storageKey="donation-popup-title"
            className="text-xl sm:text-2xl lg:text-3xl font-bold text-center font-headline"
            tag="h2"
          />
        </div>

        <div className="mb-3">
          <EditableContent
            content={defaultIntro}
            storageKey="donation-popup-intro"
            className="text-[#B4B4B4] text-xs sm:text-sm"
            tag="p"
          />
        </div>

        <div className="my-3 sm:my-4 lg:my-6 space-y-1 sm:space-y-2">
          <EditableContent
            content={defaultHighlights}
            storageKey="donation-popup-highlights"
            className=""
            tag="div"
          />
        </div>

        <div className="mb-3 sm:mb-4">
          <EditableContent
            content={defaultTagline}
            storageKey="donation-popup-tagline"
            className="font-bold text-center text-xs sm:text-sm"
            tag="p"
          />
        </div>

        <div className="mb-3 sm:mb-4">
          <EditableContent
            content={defaultMiddle}
            storageKey="donation-popup-middle"
            className="text-[#B4B4B4] text-xs sm:text-sm"
            tag="p"
          />
        </div>

        <div className="mb-3 sm:mb-4 lg:mb-6">
          <EditableContent
            content={defaultClosing}
            storageKey="donation-popup-closing"
            className="text-[#B4B4B4] text-xs sm:text-sm"
            tag="p"
          />
        </div>

        <div className="mb-2 sm:mb-3 lg:mb-4">
          <EditableContent
            content={defaultQuestion}
            storageKey="donation-popup-question"
            className="text-sm sm:text-base lg:text-lg font-bold text-center"
            tag="p"
          />
        </div>

        <div className="flex flex-col sm:flex-row justify-center sm:space-x-4 space-y-2 sm:space-y-0 mb-2 sm:mb-3">
          <a
            href="https://www.paypal.com/donate"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 sm:px-8 py-1.5 bg-[#1DAF28] text-white rounded hover:bg-[#2FD03A] transition-colors text-xs sm:text-sm font-bold text-center"
          >
            Yes, count me in!
          </a>
          <button
            onClick={onClose}
            className="px-6 sm:px-8 py-1.5 bg-[#BCE0FD] text-[#007FEB] rounded hover:bg-[#D5EEFF] transition-colors text-xs sm:text-sm font-bold text-center"
          >
            No, not right now.
          </button>
        </div>

        <div className="text-center pb-1">
          <button
            className="text-[#0089FF] hover:underline text-[10px] sm:text-xs"
            onClick={() => window.open('https://example.com/about', '_blank')}
          >
            I'd like to learn more about your bigger plans.
          </button>
        </div>
      </div>
    </div>
  );
};

export default DonationPopup;
