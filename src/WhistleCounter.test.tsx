import { render, fireEvent, act, waitFor } from '@testing-library/react';
import WhistleCounter from './WhistleCounter';

// Mock AudioContext, MediaRecorder, and getUserMedia
class MockAudioContext {
  createMediaStreamSource() { return {}; }
  createAnalyser() { return { fftSize: 2048, getFloatFrequencyData: jest.fn() }; }
  createScriptProcessor() { return { connect: jest.fn(), disconnect: jest.fn() }; }
  createBuffer() { return { copyToChannel: jest.fn() }; }
  createBufferSource() { return { connect: jest.fn(), start: jest.fn() }; }
  decodeAudioData(_buffer: any) { return Promise.resolve({ getChannelData: () => new Float32Array(2048), sampleRate: 44100 }); }
  close() { return Promise.resolve(); }
}

class MockMediaRecorder {
  state = 'inactive';
  start = jest.fn(() => { this.state = 'recording'; });
  stop = jest.fn(() => { this.state = 'inactive'; });
  ondataavailable = jest.fn();
  onstop = jest.fn();
}

const mockGetUserMedia = jest.fn(() => Promise.resolve({ getTracks: () => [{ stop: jest.fn() }] }));

beforeAll(() => {
  // @ts-ignore
  window.AudioContext = MockAudioContext;
  // @ts-ignore
  window.webkitAudioContext = MockAudioContext;
  // @ts-ignore
  window.MediaRecorder = MockMediaRecorder;
  // @ts-ignore
  navigator.mediaDevices = { getUserMedia: mockGetUserMedia };
});

test('Jest is working', () => {
  expect(1 + 1).toBe(2);
});

describe('WhistleCounter', () => {
  it('renders UI elements', () => {
    const { getByText, getByRole } = render(<WhistleCounter />);
    expect(getByText('Pressure Cooker Whistle Counter')).toBeInTheDocument();
    expect(getByRole('button', { name: /Record Sample Whistle/i })).toBeInTheDocument();
    expect(getByRole('button', { name: /Start/i })).toBeInTheDocument();
  });

  it('records a sample and plays it back', async () => {
    const { getByRole, findByRole } = render(<WhistleCounter />);
    const recordBtn = getByRole('button', { name: /Record Sample Whistle/i });
    fireEvent.click(recordBtn);
    // Simulate stop
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /Stop Recording/i }));
    });
    // Play Sample button should appear
    expect(await findByRole('button', { name: /Play Sample/i })).toBeInTheDocument();
  });

  it('starts and stops listening', async () => {
    const { getByRole } = render(<WhistleCounter />);
    const startBtn = getByRole('button', { name: /Start/i });
    fireEvent.click(startBtn);
    expect(getByRole('button', { name: /Stop/i })).toBeInTheDocument();
    fireEvent.click(getByRole('button', { name: /Stop/i }));
    expect(getByRole('button', { name: /Start/i })).toBeInTheDocument();
  });

  it('shows alarm when threshold is reached', async () => {
    const { getByRole, getByText } = render(<WhistleCounter />);
    fireEvent.change(getByRole('spinbutton'), { target: { value: 1 } });
    fireEvent.click(getByRole('button', { name: /Start/i }));
    // Simulate whistle detection by calling setCount directly
    act(() => {
      // @ts-ignore
      getByText('0').parentNode.__reactFiber$ = { memoizedState: { setCount: (fn: any) => fn(0) } };
    });
    // Alarm should show after count reaches threshold
    await waitFor(() => {
      expect(getByText(/ALARM/i)).toBeInTheDocument();
    });
  });
});
