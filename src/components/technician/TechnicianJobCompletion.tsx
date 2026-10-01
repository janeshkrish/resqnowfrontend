import React, { useEffect, useRef, useState } from 'react';
import { useTechnicianAuth } from '@/contexts/TechnicianAuthContext';
import { formatRupees } from '@/lib/technicianJobCard';

interface TechnicianJobCompletionProps {
    amount: number;
    onClose: () => void;
}

const OUTRO_SECONDS = 5;
const CHEERS = [
    'Another driver is back on the road because of you.',
    'Quick, careful work like this earns you 5-star ratings.',
    'Every job you finish builds your name on ResQNow.',
    'That customer will remember who showed up for them.',
];

/** The job-complete outro: a short well done, then back to the dashboard by itself. */
const TechnicianJobCompletion = ({ amount, onClose }: TechnicianJobCompletionProps) => {
    const { technician } = useTechnicianAuth();
    const [secondsLeft, setSecondsLeft] = useState(OUTRO_SECONDS);
    // A new line each time, fixed for as long as this outro is on screen.
    const [cheer] = useState(() => CHEERS[Math.floor(Math.random() * CHEERS.length)]);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        const timer = window.setInterval(() => setSecondsLeft((left) => Math.max(0, left - 1)), 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (secondsLeft === 0) onCloseRef.current();
    }, [secondsLeft]);

    const firstName = String(technician?.name || '').trim().split(/\s+/)[0];
    const earned = Number(amount);

    return (
        <div className="tj tj-outro" role="dialog" aria-modal="true" aria-labelledby="tj-outro-title">
            <div className="tj-outro-main">
                <svg className="tj-tick" viewBox="0 0 104 104" aria-hidden="true">
                    <circle cx="52" cy="52" r="52" />
                    <path d="M31 54L46 68L74 38" />
                </svg>
                <h2 id="tj-outro-title" className="tj-outro-title">
                    {firstName ? `Well done, ${firstName}!` : 'Well done!'}
                </h2>
                <p className="tj-outro-text">{cheer}</p>
                {Number.isFinite(earned) && earned > 0 ? (
                    <div className="tj-outro-earn">
                        <small>You earned on this job</small>
                        <b>{formatRupees(earned)}</b>
                    </div>
                ) : null}
            </div>
            <div className="tj-outro-foot">
                <p className="tj-outro-next" role="status">
                    Going to your dashboard in {secondsLeft} {secondsLeft === 1 ? 'second' : 'seconds'}
                </p>
                <div className="tj-bar" aria-hidden="true">
                    <i style={{ width: `${(secondsLeft / OUTRO_SECONDS) * 100}%` }} />
                </div>
                <button type="button" className="tj-cta is-dark rq-press" onClick={onClose}>
                    Go to dashboard
                </button>
            </div>
        </div>
    );
};

export default TechnicianJobCompletion;
