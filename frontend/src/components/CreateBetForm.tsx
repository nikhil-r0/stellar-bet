import React, { useState } from 'react';
import { createBet } from '../utils/soroban';

interface CreateBetFormProps {
  publicKey: string;
}

const CreateBetForm: React.FC<CreateBetFormProps> = ({ publicKey }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!question || !options) {
      alert('Please fill in all fields.');
      return;
    }
    setIsLoading(true);
    try {
      const optionsArray = options.split(',').map(opt => opt.trim());
      const result = await createBet(publicKey, question, optionsArray);
      console.log('Bet created with ID:', result);
      alert(`Bet created successfully! Bet ID: ${result}`);
      setQuestion('');
      setOptions('');
    } catch (error) {
      console.error('Error creating bet:', error);
      alert('Failed to create bet. See console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2>Create a New Bet</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="question">Question</label>
          <input
            id="question"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g., Who will win the next election?"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="options">Options (comma-separated)</label>
          <input
            id="options"
            type="text"
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            placeholder="e.g., Candidate A, Candidate B, Other"
            required
          />
        </div>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Bet'}
        </button>
      </form>
      <p><small>Your address will be set as the oracle for this bet.</small></p>
    </div>
  );
};

export default CreateBetForm;
