"use client";

import styled from "@emotion/styled";

const Main = styled.main`
  max-width: 640px;
  margin: 0 auto;
  padding: 6rem 1.5rem 2rem;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  margin-bottom: 1rem;
`;

const Lede = styled.p`
  margin-bottom: 0.75rem;
`;

const Footer = styled.footer`
  margin-top: 4rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e5e5;
  font-size: 0.875rem;
  color: #666;

  p {
    margin-bottom: 0.5rem;
  }

  a {
    color: #0066cc;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

export default function Home() {
  return (
    <Main>
      <Title>Seller Lab</Title>
      <Lede>Tools for Spoonflower sellers. Coming soon.</Lede>
      <Footer>
        <p>A product by ZabZabLab.</p>
        <p>
          Contact: <a href="mailto:zabzablab@gmail.com">zabzablab</a>
        </p>
      </Footer>
    </Main>
  );
}
