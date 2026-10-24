'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ChevronRight,
  X,
} from 'lucide-react';

interface LearnArticle {
  id: string;
  category: string;
  title: string;
  summary: string;
  readTime: string;
  content: string[];
  takeaway: string;
}

export const LEARN_ARTICLES: LearnArticle[] = [
  {
    id: 'how-to-read-labels',
    category: 'Foundations',
    title: 'How to Read a Nutrition Facts Panel',
    summary: 'The systematic approach to reading serving sizes, percent daily values (%DV), and macronutrient proportions.',
    readTime: '3 min read',
    content: [
      'Start with the Serving Size: All subsequent figures on the label are calibrated specifically to this portion amount. If a container holds 2.5 servings and you consume the whole container, multiply all calorie and nutrient numbers by 2.5.',
      'Examine % Daily Value (%DV): As a general FDA guideline, 5% DV or less per serving is considered low, while 20% DV or more is considered high.',
      'Check Nutrients to Get More Of: Dietary fiber, vitamin D, calcium, iron, and potassium are often under-consumed in modern diets.',
      'Check Nutrients to Moderate: Saturated fat, trans fat, sodium, and added sugars.',
    ],
    takeaway: 'Always cross-check serving sizes against your actual realistic portion size before evaluating calories.',
  },
  {
    id: 'added-sugars',
    category: 'Nutrients',
    title: 'The Truth About Added Sugars vs Total Sugars',
    summary: 'Understanding natural sugars in milk and fruit versus industrially incorporated syrups and cane sugars.',
    readTime: '4 min read',
    content: [
      'Total Sugars includes naturally occurring sugars (such as lactose in plain milk or fructose in whole fruit) as well as added sugars.',
      'Added Sugars refers specifically to sugars incorporated during manufacturing, including cane sugar, corn syrup, honey, fruit juice concentrates, and dextrose.',
      'Daily Reference Intake: The FDA recommends limiting added sugars to under 50g per day on a standard 2,000-calorie diet (the American Heart Association recommends even lower: ~25g for women, ~36g for men).',
      'Look for Hidden Aliases: Syrups, maltodextrin, invert sugar, evaporated cane juice, and molasses all represent caloric simple carbohydrates.',
    ],
    takeaway: 'Prioritize products where Added Sugars is close to 0g and total sugars are derived from whole plant bases.',
  },
  {
    id: 'sodium-realities',
    category: 'Nutrients',
    title: 'Sodium: Recommended Limits vs Packaged Realities',
    summary: 'Why processed foods account for over 70% of dietary sodium and how to identify low-sodium choices.',
    readTime: '3 min read',
    content: [
      'The Dietary Guidelines for Americans recommend keeping sodium under 2,300mg per day (roughly 1 teaspoon of table salt).',
      'The vast majority of dietary sodium does not come from the domestic salt shaker, but from packaged and prepared food formulations where salt acts as a flavor carrier and shelf preservative.',
      'FDA Standards: "Low Sodium" means 140mg or less per serving. "Very Low Sodium" is 35mg or less.',
      'Balancing with Potassium: Adequate dietary potassium (from leafy greens, beans, and potatoes) helps modulate the vascular impact of sodium.',
    ],
    takeaway: 'Check sodium per serving, especially on savory snacks, frozen meals, and canned products.',
  },
  {
    id: 'ultra-processed-nova',
    category: 'Food Processing',
    title: 'Deciphering Ultra-Processed Foods (NOVA Classification)',
    summary: 'How nutritional science categorizes food by degree of industrial processing rather than isolated nutrients.',
    readTime: '5 min read',
    content: [
      'NOVA Group 1 (Unprocessed / Minimally Processed): Edible parts of plants or animals subjected only to drying, boiling, grinding, or freezing without added substances (e.g. rolled oats, fresh apples, plain milk).',
      'NOVA Group 2 (Processed Culinary Ingredients): Substances extracted from nature used for cooking (e.g. olive oil, butter, salt, sugar).',
      'NOVA Group 3 (Processed Foods): Simple foods made by combining Group 1 and Group 2, often to increase longevity (e.g. canned beans in salt brine, fresh artisanal sourdough, canned fish).',
      'NOVA Group 4 (Ultra-Processed Foods): Industrial formulations manufactured from deconstructed food fractions (isolated soy protein, modified starches, hydrogenated fats) combined with cosmetic additives (emulsifiers, artificial dyes, flavor enhancers).',
    ],
    takeaway: 'A short ingredient list with recognizable domestic kitchen items is the hallmark of lower processing.',
  },
  {
    id: 'protein-quality',
    category: 'Nutrients',
    title: 'Protein Density & Amino Acid Completeness',
    summary: 'How to evaluate whether a "high protein" snack bar delivers genuine nutritional density.',
    readTime: '3 min read',
    content: [
      'Protein is essential for muscle synthesis, immune defense enzymes, and sustained meal satiety.',
      'Not all protein claims represent equal density: A snack bar with 5g of protein and 300 kcal is relatively low protein density (only ~7% of calories from protein).',
      'Look for the Calorie-to-Protein Ratio: High-density sources usually provide at least 1g of protein per 15–20 calories.',
      'Protein Sources: Animal sources (dairy, egg) provide complete essential amino acid profiles; plant protein blends (pea + rice or soy) can achieve equivalent completeness.',
    ],
    takeaway: 'Compare protein grams directly to total calories and serving size, not just front-of-package marketing banners.',
  },
  {
    id: 'dietary-fiber',
    category: 'Nutrients',
    title: 'Dietary Fiber: Soluble vs Insoluble',
    summary: 'The role of dietary fiber in gut microbiota health, cholesterol moderation, and glucose control.',
    readTime: '3 min read',
    content: [
      'Soluble Fiber dissolves in water to form a gel-like substance in the digestive tract. It slows carbohydrate absorption and helps regulate blood glucose and cholesterol.',
      'Insoluble Fiber adds bulk to digestive material and promotes regular intestinal transit.',
      'Synthetic vs Intact Fiber: Some processed bars add isolated chicory root fiber (inulin) or soluble corn fiber to inflate fiber stats. While functional, they do not replace intact whole-grain and vegetable matrixes.',
      'Daily Target: 25g to 38g of fiber per day depending on age and biological sex.',
    ],
    takeaway: 'Look for naturally high-fiber whole foods like oats, legumes, flax, and chia on the ingredient deck.',
  },
  {
    id: 'additives-emulsifiers',
    category: 'Ingredients',
    title: 'Common Food Additives & Emulsifiers',
    summary: 'Why additives are used, how they are regulated, and current scientific research regarding the gut microbiome.',
    readTime: '4 min read',
    content: [
      'Emulsifiers (like soy lecithin, mono- and diglycerides, polysorbate 80) prevent water and oil phases from separating in salad dressings, nut butters, and chocolates.',
      'Regulatory Clearance: Food additives undergo rigorous toxicological reviews by agencies like the FDA, EFSA, and JECFA before receiving Generally Recognized as Safe (GRAS) status.',
      'Active Research: Emerging scientific studies explore whether high habitual exposure to certain synthetic emulsifiers influences the intestinal mucus layer.',
      'Neutral Assessment: Additives serve functional roles in food security and texture; individuals can choose whole-food alternatives without unnecessary alarmism.',
    ],
    takeaway: 'Understanding an additive’s functional role removes confusion and allows informed, balanced dietary choices.',
  },
  {
    id: 'marketing-claims',
    category: 'Packaging',
    title: 'Deconstructing Front-of-Package Marketing Claims',
    summary: 'How to cut through buzzwords like "Natural", "Gluten-Free", "Immunity", and "Multigrain".',
    readTime: '4 min read',
    content: [
      '"Natural" has no strict formal FDA definition for packaged food production methods or processing levels; it merely implies no added artificial colors or synthetic flavors.',
      '"Multigrain" simply means more than one type of grain is present; it does NOT mean whole grain. Refined white flour plus a trace of barley qualifies as multigrain.',
      '"No Added Sugar" does not mean sugar-free: A product may still be naturally high in simple fruit sugars or sweetened with non-nutritive synthetic sweeteners.',
      '"Made with Real Fruit": Often signifies tiny amounts of concentrated apple juice puree amid added sugars and corn syrup.',
    ],
    takeaway: 'Flip the box over: The Nutrition Facts and Ingredients panel always tell the objective story.',
  },
];

export function LearnHub() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<LearnArticle | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Foundations', 'Nutrients', 'Food Processing', 'Ingredients', 'Packaging'];

  const filtered = LEARN_ARTICLES.filter((a) => {
    const matchesCategory = selectedCategory === 'All' || a.category === selectedCategory;
    const matchesSearch =
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-6 animate-in fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#159A6A] dark:text-[#B9D94C]">
            Nutritional Literacy
          </span>
          <span className="text-stone-300 dark:text-stone-700">·</span>
          <span className="text-xs text-stone-500">Evidence-Based Guides</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
          Learn Food Intelligence
        </h1>
        <p className="text-xs text-stone-600 dark:text-stone-400 max-w-lg mt-1">
          Scientific, transparent explanations to help you decode food labels with confidence.
        </p>
      </div>

      {/* Search & Category Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guides (e.g. sugar, sodium, ultra-processed)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1A211D] text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#159A6A]"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((article) => (
          <div
            key={article.id}
            onClick={() => setSelectedArticle(article)}
            className="group p-5 rounded-3xl bg-white dark:bg-[#1A211D] border border-stone-200/80 dark:border-stone-800 shadow-sm hover:shadow-md hover:border-[#159A6A]/40 cursor-pointer flex flex-col justify-between transition-all"
          >
            <div>
              <div className="flex items-center justify-between text-[11px] text-stone-400 mb-2">
                <span className="font-semibold uppercase tracking-wider text-[#159A6A] dark:text-[#B9D94C]">
                  {article.category}
                </span>
                <span>{article.readTime}</span>
              </div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 group-hover:text-[#159A6A] transition-colors mb-2">
                {article.title}
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed mb-4">
                {article.summary}
              </p>
            </div>

            <div className="pt-3 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between text-xs font-semibold text-[#159A6A] dark:text-[#B9D94C]">
              <span>Read Guide</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>

      {/* Article Detail Drawer / Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-[#1A211D] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 shrink-0">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#159A6A] dark:text-[#B9D94C]">
                  {selectedArticle.category} · {selectedArticle.readTime}
                </span>
                <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  {selectedArticle.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedArticle(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
              {selectedArticle.content.map((p, idx) => (
                <p key={idx} className="leading-relaxed">
                  {p}
                </p>
              ))}

              <div className="p-4 rounded-2xl bg-[#DDF5EA]/40 dark:bg-emerald-950/30 border border-[#159A6A]/30 mt-6">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#159A6A] dark:text-[#B9D94C] block mb-1">
                  Key Takeaway:
                </span>
                <p className="text-xs text-stone-800 dark:text-stone-200 font-medium">
                  {selectedArticle.takeaway}
                </p>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-stone-50 dark:bg-stone-900/60 border-t border-stone-100 dark:border-stone-800 shrink-0 flex justify-end">
              <button
                onClick={() => setSelectedArticle(null)}
                className="px-5 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold"
              >
                Done Reading
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
