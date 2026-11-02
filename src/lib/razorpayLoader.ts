let pending: Promise<void> | null = null;

/** Recovery pages load no payment scripts; checkout loads when payment begins. */
export function loadRazorpay(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve();
  if (pending) return pending;
  pending = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'resqnow-razorpay';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    const finish = (ok: boolean) => {
      clearTimeout(timeout);script.onload=null;script.onerror=null;pending=null;
      if (ok) resolve();
      else { script.remove();reject(new Error('Could not load the payment gateway. Please try again.')); }
    };
    const timeout = setTimeout(()=>finish(false),15000);
    script.onload=()=>finish(Boolean((window as any).Razorpay));
    script.onerror=()=>finish(false);
    document.head.appendChild(script);
  });
  return pending;
}
