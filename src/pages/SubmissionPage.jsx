import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ThreeGraphVisualization from '../components/graph/ThreeGraphVisualization';
import Layout from '../components/layout/Layout';
import { formatGraphData } from '../utils/dataUtils';
import { FaUpload, FaLink, FaFilePdf, FaFileAlt, FaCheck, FaTimes, FaChartLine, FaTag } from 'react-icons/fa';
import Loader from '../components/common/Loader';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const SubmissionPage = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  
  const [submissionType, setSubmissionType] = useState('text');
  const [inputText, setInputText] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  
  const [subscription, setSubscription] = useState(null);
  const [loadingSubscription, setLoadingSubscription] = useState(false);

  useEffect(() => {
    fetchSubscriptions();
    fetchSubmissions();
  }, []);

  const fetchSubscriptions = async () => {
    setLoadingSubscription(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/subscription`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoadingSubscription(false);
    }
  };

  const fetchSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/submissions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data);
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        showError('Only PDF files are allowed', 'Invalid File Type');
        return;
      }
      setPdfFile(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (submissionType === 'text' && !inputText.trim()) {
      showError('Please enter some text', 'Validation Error');
      return;
    }
    
    if (submissionType === 'url' && !inputUrl.trim()) {
      showError('Please enter a URL', 'Validation Error');
      return;
    }
    
    if (submissionType === 'pdf' && !pdfFile) {
      showError('Please select a PDF file', 'Validation Error');
      return;
    }

    setSubmitting(true);
    
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      
      formData.append('submission_type', submissionType);
      formData.append('tags', JSON.stringify(tags.split(',').map(t => t.trim()).filter(t => t)));
      
      if (submissionType === 'text') {
        formData.append('input_data', inputText);
      } else if (submissionType === 'url') {
        formData.append('input_url', inputUrl);
      } else if (submissionType === 'pdf') {
        formData.append('file', pdfFile);
      }

      const response = await fetch(`${API_BASE_URL}/api/submissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        showSuccess('Submission created successfully!', 'Success');
        setInputText('');
        setInputUrl('');
        setPdfFile(null);
        setTags('');
        
        // Fetch updated submissions
        await fetchSubmissions();
        
        // Select the new submission
        if (data.id) {
          setSelectedSubmission(data);
        }
      } else {
        showError(data.detail || 'Failed to create submission', 'Error');
      }
    } catch (error) {
      console.error('Error submitting:', error);
      showError('An error occurred while submitting', 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'processing':
        return 'text-yellow-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <FaCheck className="text-green-400" />;
      case 'processing':
        return <div className="inline-block"><Loader size={16} color="#facc15" /></div>;
      case 'failed':
        return <FaTimes className="text-red-400" />;
      default:
        return null;
    }
  };

  // Format graph data for visualization
  const rawGraphData = selectedSubmission?.processing_result?.graph_data || null;
  const graphData = rawGraphData ? formatGraphData(rawGraphData) : null;

  return (
    <Layout>
      <div className="min-h-screen bg-[#09090B] text-white p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Submit Data for Analysis</h1>
          
          {/* Subscription Status */}
          {subscription && (
            <div className="bg-[#18181B] border border-[#3F3F46] rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Subscription: {subscription.subscription_tier.toUpperCase()}</h3>
                  <p className="text-sm text-gray-400">
                    {subscription.requests_this_month} / {subscription.monthly_limit} requests this month
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400">Rate Limit</div>
                  <div className="text-lg font-semibold">{subscription.requests_per_second_limit} req/sec</div>
                </div>
              </div>
              <div className="mt-3 w-full bg-[#3F3F46] rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${(subscription.requests_this_month / subscription.monthly_limit) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Submission Form */}
            <div className="bg-[#18181B] border border-[#3F3F46] rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">New Submission</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Submission Type */}
                <div>
                  <label className="block text-sm font-medium mb-2">Submission Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSubmissionType('text')}
                      className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                        submissionType === 'text'
                          ? 'bg-blue-600 border-blue-500'
                          : 'bg-[#27272A] border-[#3F3F46] hover:bg-[#3F3F46]'
                      }`}
                    >
                      <FaFileAlt className="inline mr-2" />
                      Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubmissionType('url')}
                      className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                        submissionType === 'url'
                          ? 'bg-blue-600 border-blue-500'
                          : 'bg-[#27272A] border-[#3F3F46] hover:bg-[#3F3F46]'
                      }`}
                    >
                      <FaLink className="inline mr-2" />
                      URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubmissionType('pdf')}
                      className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                        submissionType === 'pdf'
                          ? 'bg-blue-600 border-blue-500'
                          : 'bg-[#27272A] border-[#3F3F46] hover:bg-[#3F3F46]'
                      }`}
                    >
                      <FaFilePdf className="inline mr-2" />
                      PDF
                    </button>
                  </div>
                </div>

                {/* Input Fields */}
                {submissionType === 'text' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Text Content</label>
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="w-full bg-[#27272A] border border-[#3F3F46] rounded-lg px-4 py-2 text-white min-h-[200px]"
                      placeholder="Enter text to analyze..."
                    />
                  </div>
                )}

                {submissionType === 'url' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">URL</label>
                    <input
                      type="url"
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      className="w-full bg-[#27272A] border border-[#3F3F46] rounded-lg px-4 py-2 text-white"
                      placeholder="https://example.com/article"
                    />
                  </div>
                )}

                {submissionType === 'pdf' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">PDF File</label>
                    <div className="border-2 border-dashed border-[#3F3F46] rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="hidden"
                        id="pdf-upload"
                      />
                      <label
                        htmlFor="pdf-upload"
                        className="cursor-pointer flex flex-col items-center"
                      >
                        <FaUpload className="text-4xl mb-2 text-gray-400" />
                        <span className="text-sm text-gray-400">
                          {pdfFile ? pdfFile.name : 'Click to upload PDF'}
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <FaTag className="inline mr-2" />
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full bg-[#27272A] border border-[#3F3F46] rounded-lg px-4 py-2 text-white"
                    placeholder="tag1, tag2, tag3"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  {submitting ? (
                    <>
                      <div className="inline-block mr-2"><Loader size={16} color="#ffffff" /></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <FaUpload className="inline mr-2" />
                      Submit
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Submissions List */}
            <div className="bg-[#18181B] border border-[#3F3F46] rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Your Submissions</h2>
              
              {loadingSubmissions ? (
                <div className="text-center py-8">
                  <Loader size={48} />
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No submissions yet
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {submissions.map((submission) => (
                    <div
                      key={submission.id}
                      onClick={() => setSelectedSubmission(submission)}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedSubmission?.id === submission.id
                          ? 'bg-blue-900/30 border-blue-500'
                          : 'bg-[#27272A] border-[#3F3F46] hover:bg-[#3F3F46]'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getStatusIcon(submission.status)}
                            <span className="font-semibold capitalize">{submission.submission_type}</span>
                            <span className={`text-sm ${getStatusColor(submission.status)}`}>
                              {submission.status}
                            </span>
                          </div>
                          <div className="text-sm text-gray-400">
                            {submission.input_url || submission.file_name || 'Text submission'}
                          </div>
                          {submission.tags && submission.tags.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {submission.tags.map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs bg-[#3F3F46] px-2 py-1 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(submission.created_at).toLocaleString()}
                          </div>
                        </div>
                        {submission.status === 'completed' && (
                          <FaChartLine className="text-blue-400 ml-2" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Graph Visualization */}
          {selectedSubmission && selectedSubmission.status === 'completed' && graphData && (
            <div className="mt-6 bg-[#18181B] border border-[#3F3F46] rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Graph Visualization</h2>
              <div className="h-[600px] bg-[#09090B] rounded-lg">
                <ThreeGraphVisualization
                  data={graphData}
                  onNodeClick={(node) => console.log('Node clicked:', node)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default SubmissionPage;
