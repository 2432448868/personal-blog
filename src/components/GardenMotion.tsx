import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** 首页动效不接管导航；卸载和媒体条件变化时一并回收。 */
export default function GardenMotion() {
  useGSAP(() => {
    const garden = document.querySelector<HTMLElement>('[data-garden]');
    if (!garden) return;
    const media = gsap.matchMedia();
    media.add({
      motion: '(prefers-reduced-motion: no-preference)',
      desktop: '(min-width: 1024px)',
      pointer: '(hover: hover) and (pointer: fine)'
    }, (context) => {
      const { motion, desktop, pointer } = context.conditions ?? {};
      garden.dataset.motionState = motion ? 'active' : 'static';
      if (!motion) return;
      const removers: Array<() => void> = [];
      const art = garden.querySelector('.growth-svg');
      const notes = garden.querySelector('.notes-section');
      const index = garden.querySelector('[data-pin-index]');
      if (desktop && notes && index) {
        ScrollTrigger.create({ trigger: notes, start: 'top 112px',
          end: () => '+=' + Math.max(0, notes.clientHeight - index.clientHeight),
          pin: index, pinSpacing: false, invalidateOnRefresh: true });
      }
      if (art) {
        gsap.fromTo(art, { scale: .8 }, { scale: 1, ease: 'none',
          scrollTrigger: { trigger: art, start: 'top bottom', end: 'center center', scrub: .7 } });
        gsap.to(art, { y: -40, opacity: .2, ease: 'none',
          scrollTrigger: { trigger: '.folio-hero', start: 'top top', end: 'bottom top', scrub: .7 } });
        gsap.to(garden.querySelectorAll('.growth-leaf'), { rotation: 5, transformOrigin: '240px 344px', stagger: .08, ease: 'none',
          scrollTrigger: { trigger: '.folio-hero', start: 'top top', end: 'bottom top', scrub: 1 } });
      }
      garden.querySelectorAll('.notes-feed .article-row').forEach((row) => {
        gsap.fromTo(row, { y: 22 }, { y: 0, ease: 'none',
          scrollTrigger: { trigger: row, start: 'top 95%', end: 'top 75%', scrub: .4 } });
      });
      const words = garden.querySelectorAll('[data-word-reveal] span');
      if (words.length) gsap.fromTo(words, { opacity: .25 }, {
        opacity: 1, stagger: .1, ease: 'none',
        scrollTrigger: { trigger: '[data-word-reveal]', start: 'top 90%', end: 'top 55%', scrub: .6 }
      });
      if (pointer) {
        garden.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((element) => {
          const xTo = gsap.quickTo(element, 'x', { duration: .35, ease: 'power3.out' });
          const yTo = gsap.quickTo(element, 'y', { duration: .35, ease: 'power3.out' });
          const move = (event: PointerEvent) => {
            const bounds = element.getBoundingClientRect();
            xTo(gsap.utils.clamp(-6, 6, (event.clientX - bounds.left - bounds.width / 2) * .12));
            yTo(gsap.utils.clamp(-4, 4, (event.clientY - bounds.top - bounds.height / 2) * .12));
          };
          const reset = () => { xTo(0); yTo(0); };
          element.addEventListener('pointermove', move);
          element.addEventListener('pointerleave', reset);
          element.addEventListener('blur', reset);
          removers.push(() => {
            element.removeEventListener('pointermove', move);
            element.removeEventListener('pointerleave', reset);
            element.removeEventListener('blur', reset);
          });
        });
      }
      garden.querySelectorAll<HTMLElement>('.path-card').forEach((card) => {
        const target = card.querySelector('.path-icon');
        const hover = gsap.to(target, { rotation: -12, scale: 1.08, duration: .35, ease: 'power3.out', paused: true });
        const enter = () => { hover.play(); };
        const leave = () => { hover.reverse(); };
        card.addEventListener('pointerenter', enter); card.addEventListener('pointerleave', leave);
        card.addEventListener('focus', enter); card.addEventListener('blur', leave);
        removers.push(() => {
          card.removeEventListener('pointerenter', enter); card.removeEventListener('pointerleave', leave);
          card.removeEventListener('focus', enter); card.removeEventListener('blur', leave);
        });
      });
      const refresh = () => ScrollTrigger.refresh();
      garden.querySelectorAll('img').forEach(image => {
        if (!image.complete) {
          image.addEventListener('load', refresh, { once: true });
          removers.push(() => image.removeEventListener('load', refresh));
        }
      });
      refresh();
      return () => removers.forEach(remove => remove());
    });
    return () => { media.revert(); delete garden.dataset.motionState; };
  }, []);
  return null;
}
