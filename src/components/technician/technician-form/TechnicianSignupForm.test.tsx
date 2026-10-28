import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TechnicianSignupForm } from './TechnicianSignupForm';

describe('legacy technician signup contract', () => {
  beforeEach(() => { vi.stubGlobal('ResizeObserver',class { observe() {} unobserve() {} disconnect() {} }); });
  afterEach(() => { vi.unstubAllGlobals(); });
  it('renders the existing option catalog and preserves independently selected vehicles', () => {
    render(<MemoryRouter future={{ v7_startTransition:true,v7_relativeSplatPath:true }}><TechnicianSignupForm onSubmit={vi.fn()} isSubmitting={false} /></MemoryRouter>);
    expect(screen.getByRole('heading',{name:'Technician Registration'})).toBeInTheDocument();
    const car=screen.getByRole('checkbox',{name:'Car'});
    const bike=screen.getByRole('checkbox',{name:'Bike'});
    fireEvent.click(car);fireEvent.click(bike);
    expect(car).toBeChecked();expect(bike).toBeChecked();
    fireEvent.click(car);
    expect(car).not.toBeChecked();expect(bike).toBeChecked();
    expect(screen.getByRole('combobox')).toHaveTextContent('Select Service Type');
  });
});
