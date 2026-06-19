module.exports = {
  categoryName: 'marketplace',
  adminRole: 'Admin',
  artistRole: 'Artist',
  buyerRole: 'Buyer',
  disciplines: ['Modeler'],
  forumRoles: {
    models: 'Modeler',
  },
  categories: {
    Models: {
      forum: 'models',
      tags: ['Low-Poly', 'Mid-Poly', 'High-Poly', 'Stylized', 'Sculpt', 'Textured', 'No Texture'],
    },
  },
  deadlines: [
    'No deadline',
    '1 day',
    '2 days',
    '3 days',
    '5 days',
    '1 week',
    '2 weeks',
    '3 weeks',
    '1 month',
  ],
  levels: [
    { role: 'Level 1', min: 0,  maxAccepted: 1 },
    { role: 'Level 2', min: 5,  maxAccepted: 2 },
    { role: 'Level 3', min: 15, maxAccepted: 2 },
    { role: 'Level 4', min: 30, maxAccepted: 3 },
    { role: 'Level 5', min: 50, maxAccepted: 3 },
  ],
  tags: {
    unclaimed:  'Open',
    inProgress: 'In-Progress',
    paid:       'Paid',
    done:       'Completed',
    closed:     'Closed',
  },
};
