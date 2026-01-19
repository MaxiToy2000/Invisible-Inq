import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import Header from '../components/layout/Header';
import EditableContent from '../components/common/EditableContent';

const ContactPage = () => {
  const { showSuccess } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [formStatus, setFormStatus] = useState(null);

  const defaultTitle = 'Contact Us';
  const defaultDescription = `Have questions, feedback, or suggestions about Graph Explorer? We'd love to hear from you!
Fill out the form below and we'll get back to you as soon as possible.`;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    setFormStatus('submitting');

    setTimeout(() => {
      setFormStatus(null);
      showSuccess('Thank you for your message! We\'ll get back to you soon.', 'Message Sent');
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
    }, 1500);
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <Header
        showStoryDropdown={false}
      />
      <main className="flex-1 container mx-auto px-4 pt-6 pb-8 bg-black relative z-10">
        <div className="max-w-2xl mx-auto bg-black">
          <div className="relative group mb-6">
            <EditableContent
              content={defaultTitle}
              storageKey="contact-page-title"
              className="text-3xl font-bold text-white"
              tag="h1"
            />
          </div>

          <div className="mb-6">
            <EditableContent
              content={defaultDescription}
              storageKey="contact-page-description"
              className="text-gray-300"
              tag="p"
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-white mb-1">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-[#707070] rounded-md shadow-sm bg-[#222222] text-white focus:outline-none focus:ring-gray-500 focus:border-gray-400"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-white mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-[#707070] rounded-md shadow-sm bg-[#222222] text-white focus:outline-none focus:ring-gray-500 focus:border-gray-400"
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-white mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-[#707070] rounded-md shadow-sm bg-[#222222] text-white focus:outline-none focus:ring-gray-500 focus:border-gray-400"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-white mb-1">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows="5"
                  className="w-full px-3 py-2 border border-[#707070] rounded-md shadow-sm bg-[#222222] text-white focus:outline-none focus:ring-gray-500 focus:border-gray-400"
                ></textarea>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={formStatus === 'submitting'}
                  className="w-full bg-blue-700 text-white py-2 px-4 rounded-md hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {formStatus === 'submitting' ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>

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

export default ContactPage;
