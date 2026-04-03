const fs = require('fs');

function redesignPlanner() {
  let code = fs.readFileSync('src/pages/planner.jsx', 'utf8');

  // Replace chaotic background grids for main div
  code = code.replace(/background: dark\s*\?\s*"radial-gradient.*?,\s*var\(--bg-primary\)"/s, "background: 'var(--bg-primary)'");

  // Fix Hero card
  code = code.replace(/className="planner-hero[^>]+>/g, 'className="glass-card p-6 lg:p-8 mb-6 relative overflow-hidden">');
  
  // Fix header background to match dashboard
  code = code.replace(/background: dark \? "rgba\(8,10,18,0\.78\)" : "rgba\(252,252,254,0\.82\)"/g, "background: dark ? 'rgba(12,14,20,0.85)' : 'rgba(248,249,252,0.85)'");

  // Fix 'planner-card' to 'glass-card glass-card-hover flex flex-col h-full' where suitable
  // We'll target specific sections in the 3-col grids
  
  // For the Social Timer section
  code = code.replace(/<section className="rounded-\[28px\] p-5 planner-card planner-subtle">/g, '<section className="glass-card glass-card-hover h-full p-6 flex flex-col">');
  code = code.replace(/<section className="rounded-\[28px\] p-5 planner-card">/g, '<section className="glass-card glass-card-hover h-full p-6 flex flex-col">');

  // And for the queue task card
  code = code.replace(/<section className="rounded-\[30px\] p-5 lg:p-6 planner-card">/g, '<section className="glass-card h-full p-6 flex flex-col">');

  // And for the Distracted / AI feedback cards
  code = code.replace(/className="flex items-center gap-3 p-4 rounded-\[24px\] planner-card"/g, 'className="glass-card p-4 flex items-center gap-4"');
  code = code.replace(/<div className="p-6 rounded-\[30px\] planner-card">/g, '<div className="glass-card h-full p-6 flex flex-col items-center justify-center">');
  code = code.replace(/<div className="p-6 rounded-\[28px\] planner-card">/g, '<div className="glass-card p-6 flex flex-col">');

  fs.writeFileSync('src/pages/planner.jsx', code);

  // Now fix PlannerSections
  let sections = fs.readFileSync('src/pages/planner/PlannerSections.jsx', 'utf8');
  sections = sections.replace(/<div className="rounded-\[28px\] p-5 planner-card planner-subtle">/g, '<div className="glass-card h-full p-6 flex flex-col">');
  
  fs.writeFileSync('src/pages/planner/PlannerSections.jsx', sections);
  console.log('Modified classnames for premium UI consistency');
}

redesignPlanner();
