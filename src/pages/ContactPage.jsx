import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import ContactPopup from '../components/common/ContactPopup';

const ContactPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <Header showStoryDropdown={false} />
      <ContactPopup onClose={() => navigate('/')} />
    </div>
  );
};

export default ContactPage;
