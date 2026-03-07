import { useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import { useToast } from '../../contexts/ToastContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const ContactPopup = ({ onClose }) => {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    message: '',
    signUpForUpdates: false
  });
  const [formStatus, setFormStatus] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setSubmitError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormStatus('submitting');
    setSubmitError(null);
    try {
      const body = {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone != null ? String(formData.phone).trim() : '',
        message: formData.message != null ? String(formData.message).trim() : '',
        sign_up_for_updates: Boolean(formData.signUpForUpdates)
      };
      const response = await fetch(`${API_BASE_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        let detail = data.detail;
        if (Array.isArray(detail) && detail.length > 0) {
          detail = detail.map((d) => d.msg || d.message).filter(Boolean).join(' ') || 'Validation failed.';
        } else if (typeof detail !== 'string') {
          detail = 'Failed to send message.';
        }
        throw new Error(detail);
      }
      showSuccess(
        formData.signUpForUpdates
          ? "Thank you! Your message was sent and you're signed up for story and site updates."
          : "Thank you for your message! We'll get back to you soon.",
        'Message Sent'
      );
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        message: '',
        signUpForUpdates: false
      });
      onClose();
    } catch (err) {
      const msg = err.message || 'Failed to send. Please try again.';
      setSubmitError(msg);
      showError(msg, 'Error');
    } finally {
      setFormStatus(null);
    }
  };

  const inputClass =
    'w-full px-3 py-2 border border-white/60 rounded bg-black text-white placeholder-gray-500 focus:outline-none focus:border-white';
  const labelClass = 'block text-sm font-medium text-white mb-3';

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

        <form onSubmit={handleSubmit} className="space-y-2">
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

          {submitError && (
            <p className="text-red-400 text-sm" role="alert">
              {submitError}
            </p>
          )}

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
