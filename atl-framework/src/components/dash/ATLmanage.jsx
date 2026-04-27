import React, { useState } from "react";
import Sidebar from "./sidebar";
import criteriamanagement from "./criteriamanagement";
import ExpertManagement from "./expertmanagement";
import { dummyATL } from "./dummyATL";

export default function ATLmanage() {
  const [activeTab, setActiveTab] = useState("criteria");
  const [selectedTopic, setSelectedTopic] = useState("singing_christmas_carol");

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar user={{ name: "Joko Wiryanto", role: "Guru / Evaluator" }} />

      {/* Main Content */}
      <main className="relative flex flex-1 flex-col overflow-hidden bg-stone-50">
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-8">
            {/* Header */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="px-2 py-0.5 rounded bg-primary/20 text-primary-hover text-[10px] font-bold uppercase tracking-widest">
                  Settings / ATL Management
                </span>
                <h1 className="mt-3 text-3xl font-black text-text-main-light lg:text-4xl">
                  ATL System Management
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-text-sub-light">
                  Tentukan dan kelola kriteria penilaian untuk setiap sub-topik pembelajaran dengan deskripsi level yang jelas.
                </p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="rounded-2xl border border-stone-200/90 bg-white shadow-[0_8px_16px_rgba(15,23,42,0.04)]">
              <div className="flex border-b border-stone-200/90">
                <button
                  onClick={() => setActiveTab("criteria")}
                  className={`flex-1 px-6 py-4 font-semibold text-sm transition-all duration-300 ${
                    activeTab === "criteria"
                      ? "text-primary border-b-2 border-primary"
                      : "text-text-sub-light hover:text-text-main-light border-b-2 border-transparent"
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-lg">assignment</span>
                    Manajemen Kriteria
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`flex-1 px-6 py-4 font-semibold text-sm transition-all duration-300 ${
                    activeTab === "settings"
                      ? "text-primary border-b-2 border-primary"
                      : "text-text-sub-light hover:text-text-main-light border-b-2 border-transparent"
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-lg">tune</span>
                    Pengaturan ATL
                  </span>
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {activeTab === "criteria" && React.createElement(criteriamanagement)}
                {activeTab === "settings" && (
                  <ExpertManagement 
                    onAddCriteriaClick={() => setActiveTab("criteria")} 
                    onTopicChange={(id) => setSelectedTopic(id)}
                  />
                )}
              </div>
            </div>

            {/* TRACKING SECTION: KRITERIA & BOBOT TERPANTAU */}
            <div className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-black text-stone-900">Summary Kriteria & Bobot</h3>
                  <p className="text-xs text-stone-500">Pelacakan bobot Fuzzy AHP yang tersimpan untuk sub-topik aktif.</p>
                </div>
                <span className="rounded-full bg-stone-100 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-600">
                  Topic ID: {selectedTopic}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {(dummyATL[selectedTopic] || []).map((item, idx) => {
                  const savedWeights = dummyATL.savedWeights?.[selectedTopic] || {};
                  // Cari weight yang cocok dengan kriteria (Unique Label format)
                  const weightKey = item.atl.map(a => `${item.kriteria} (${a})`)[0];
                  const weightValue = savedWeights[weightKey] || "0.00";

                  return (
                    <div key={idx} className="rounded-2xl border border-stone-100 bg-stone-50/50 p-4 transition-all hover:border-primary/30">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex gap-1">
                          {item.atl.map(a => (
                            <span key={a} className="h-2 w-2 rounded-full bg-primary"></span>
                          ))}
                        </div>
                        <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded italic">
                          W: {weightValue}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-stone-800 line-clamp-2 mb-1">{item.kriteria}</h4>
                      <p className="text-[10px] text-stone-500 uppercase font-medium">{item.atl.join(", ")}</p>
                    </div>
                  );
                })}
                {(!dummyATL[selectedTopic] || dummyATL[selectedTopic].length === 0) && (
                  <div className="col-span-full py-10 text-center text-stone-400 text-sm italic">
                    Belum ada kriteria yang terdaftar untuk topik ini.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
