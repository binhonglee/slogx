import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import JsonViewer from './JsonViewer';

describe('JsonViewer', () => {
  describe('primitive values', () => {
    it('renders null', () => {
      render(<JsonViewer data={null} />);
      expect(screen.getByText('null')).toBeDefined();
    });

    it('renders undefined', () => {
      render(<JsonViewer data={undefined} />);
      expect(screen.getByText('undefined')).toBeDefined();
    });

    it('renders boolean true', () => {
      render(<JsonViewer data={true} />);
      expect(screen.getByText('true')).toBeDefined();
    });

    it('renders boolean false', () => {
      render(<JsonViewer data={false} />);
      expect(screen.getByText('false')).toBeDefined();
    });

    it('renders numbers', () => {
      render(<JsonViewer data={42} />);
      expect(screen.getByText('42')).toBeDefined();
    });

    it('renders strings with quotes', () => {
      render(<JsonViewer data="hello" />);
      expect(screen.getByText('"hello"')).toBeDefined();
    });
  });

  describe('empty collections', () => {
    it('renders empty array', () => {
      render(<JsonViewer data={[]} />);
      expect(screen.getByText('[]')).toBeDefined();
    });

    it('renders empty object', () => {
      render(<JsonViewer data={{}} />);
      expect(screen.getByText('{}')).toBeDefined();
    });
  });

  describe('arrays', () => {
    it('renders array with count when collapsed', () => {
      render(<JsonViewer data={[1, 2, 3]} />);
      expect(screen.getByText('Array(3)')).toBeDefined();
    });

    it('expands array on click', () => {
      render(<JsonViewer data={[1, 2, 3]} />);

      const toggle = screen.getByText('Array(3)');
      fireEvent.click(toggle);

      expect(screen.getByText('0:')).toBeDefined();
      expect(screen.getByText('1')).toBeDefined();
    });
  });

  describe('objects', () => {
    it('renders Object label when collapsed', () => {
      render(<JsonViewer data={{ key: 'value' }} />);
      expect(screen.getByText('Object')).toBeDefined();
    });

    it('expands object on click', () => {
      render(<JsonViewer data={{ name: 'test' }} />);

      const toggle = screen.getByText('Object');
      fireEvent.click(toggle);

      expect(screen.getByText('name:')).toBeDefined();
      expect(screen.getByText('"test"')).toBeDefined();
    });

    it('renders initially expanded when prop is set', () => {
      render(<JsonViewer data={{ foo: 'bar' }} initialExpanded={true} />);
      expect(screen.getByText('foo:')).toBeDefined();
      expect(screen.getByText('"bar"')).toBeDefined();
    });
  });

  describe('nested structures', () => {
    it('handles nested objects', () => {
      render(<JsonViewer data={{ outer: { inner: 'value' } }} initialExpanded={true} />);

      expect(screen.getByText('outer:')).toBeDefined();

      // There are multiple "Object" texts - get the nested one (second)
      const objectToggles = screen.getAllByText('Object');
      expect(objectToggles.length).toBe(2);

      // Click the nested object toggle (has the collapsed arrow ▶)
      fireEvent.click(objectToggles[1]);

      expect(screen.getByText('inner:')).toBeDefined();
      expect(screen.getByText('"value"')).toBeDefined();
    });
  });
});
