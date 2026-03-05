import { useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import { useToast } from '../../contexts/ToastContext';

const ContactPopup = ({ onClose }) => {
  const { showSuccess } = useToast();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    message: '',
    signUpForUpdates: false
  });
  const [formStatus, setFormStatus] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormStatus('submitting');
    setTimeout(() => {
      setFormStatus(null);
      showSuccess('Thank you for your message! We\'ll get back to you soon.', 'Message Sent');
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        message: '',
        signUpForUpdates: false
      });
      onClose();
    }, 1500);
  };

  const inputClass =
    'w-full px-3 py-2 border border-white/60 rounded bg-black text-white placeholder-gray-500 focus:outline-none focus:border-white';
  const labelClass = 'block text-sm font-medium text-white mb-1';

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-black border border-[#707070] p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-2xl text-white overflow-y-auto max-h-[90vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 text-[#B4B4B4] hover:text-white transition-colors p-1 z-10"
          title="Close"
          aria-label="Close popup"
        >
          <FaTimes size={20} />
        </button>

        <div className="relative mb-6 pr-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center">Contact us</h2>
          <p className="text-sm text-gray-300 text-center mt-2">
            Send us a message - or an empty message to get on our mailing list.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="contact-firstName" className={labelClass}>
                first name <span className="text-gray-400 text-xs font-normal">(mandatory)</span>
              </label>
              <input
                type="text"
                id="contact-firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="contact-lastName" className={labelClass}>
                last name <span className="text-gray-400 text-xs font-normal">(mandatory)</span>
              </label>
              <input
                type="text"
                id="contact-lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="contact-email" className={labelClass}>
                email <span className="text-gray-400 text-xs font-normal">(mandatory)</span>
              </label>
              <input
                type="email"
                id="contact-email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="contact-phone" className={labelClass}>
                phone
              </label>
              <input
                type="tel"
                id="contact-phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="contact-message" className={labelClass}>
              message
            </label>
            <textarea
              id="contact-message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows={5}
              className={`${inputClass} resize-y min-h-[120px]`}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-white">
            <span className="flex-shrink-0 w-5 h-5 border border-white/60 rounded flex items-center justify-center bg-black">
              {formData.signUpForUpdates ? (
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <span className="text-white/0">&#10008;</span>
              )}
            </span>
            <input
              type="checkbox"
              name="signUpForUpdates"
              checked={formData.signUpForUpdates}
              onChange={handleChange}
              className="sr-only"
            />
            <span className="text-sm">sign me up for story and site updates</span>
          </label>

          <div className="flex justify-center pt-2">
            <button
              type="submit"
              disabled={formStatus === 'submitting'}
              className="px-8 py-2 border border-white/60 rounded bg-black text-white hover:bg-white/10 focus:outline-none focus:border-white disabled:opacity-50"
            >
              {formStatus === 'submitting' ? 'Sending...' : 'submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContactPopup;
