import React, { useState, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { DotsIcon } from './TrackControls/DotsIcon';

export interface TrackMenuItem {
  id: string;
  label?: string;
  content: ReactNode;
}

export interface TrackMenuProps {
  items: TrackMenuItem[] | ((onClose: () => void) => TrackMenuItem[]);
}

const MenuContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const MenuButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  opacity: 0.7;

  &:hover {
    opacity: 1;
  }
`;

const Dropdown = styled.div<{ $top: number; $left: number }>`
  position: fixed;
  top: ${p => p.$top}px;
  left: ${p => p.$left}px;
  z-index: 10000;
  background: ${p => p.theme.timescaleBackgroundColor ?? '#222'};
  color: ${p => p.theme.textColor ?? 'inherit'};
  border: 1px solid rgba(128, 128, 128, 0.4);
  border-radius: 6px;
  padding: 0.5rem 0;
  min-width: 180px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid rgba(128, 128, 128, 0.3);
  margin: 0.35rem 0;
`;

export const TrackMenu: React.FC<TrackMenuProps> = ({
  items: itemsProp,
}) => {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const items = typeof itemsProp === 'function' ? itemsProp(close) : itemsProp;
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Position dropdown below the button when opening
  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 2,
        left: Math.max(0, rect.right - 180),
      });
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <MenuContainer>
      <MenuButton
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(prev => !prev);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        title="Track menu"
        aria-label="Track menu"
      >
        <DotsIcon size={16} />
      </MenuButton>
      {open && typeof document !== 'undefined' && createPortal(
        <Dropdown
          ref={dropdownRef}
          $top={dropdownPos.top}
          $left={dropdownPos.left}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {items.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && <Divider />}
              {item.content}
            </React.Fragment>
          ))}
        </Dropdown>,
        document.body
      )}
    </MenuContainer>
  );
};
