# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Guests searching for and booking stays, and hosts creating and managing their properties.

## Product Purpose

Checkin is a full-stack stays marketplace for searching listings by location and date, reserving stays in a few taps, and managing the guest and host sides of a booking.

## Positioning

A test-mode marketplace that makes the entire stay lifecycle—from discovery through simulated booking, payment, and hosting—clear and trustworthy.

## Operating Context

Guests use Checkin to explore properties, compare availability, and make reservations. Hosts use it to publish properties, manage availability and bookings, communicate with guests, and inspect simulated earnings.

## Capabilities and Constraints

- Next.js 16, Tailwind CSS v4, Clerk, and Convex.
- English and USD; stays are one reservable unit, 1–28 nights, with editable 15:00 check-in and 11:00 checkout.
- Payments, refunds, transfers, and payouts are simulated and must be explicitly labeled.
- Discovery is public; hosting, trips, checkout, messages, wishlists, and billing require sign-in.
- Do not use Vitest or convex-test. Unit tests use Node's built-in test runner with `tsx`.

## Brand Commitments

- Product name: Checkin.
- The visual system and brand assets, including the favicon, will be authored for this product rather than relying on supplied assets.

## Evidence on Hand

- The repository contains the product scaffold and functional backend foundations.
- There are no supplied brand assets, photography, testimonials, or commercial claims to reuse.

## Product Principles

- Make finding and reserving a stay feel immediate and dependable.
- Make price, booking mode, and simulated-payment status understandable at a glance.
- Give guests confidence without hiding important details.
- Give hosts practical, legible tools for operating properties.
- Preserve privacy and authorization boundaries throughout the product.

## Accessibility & Inclusion

- Build responsive interfaces with keyboard access, visible focus, readable contrast, and touch-friendly controls.
