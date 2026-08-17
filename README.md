# 📄 PaperIsHere - Smart Scholar Renamer

**PaperIsHere** is a minimalist, typography-driven Chrome Extension designed to streamline the workflow of researchers and academics. It acts as an intelligent assistant that automatically extracts metadata from academic papers and renames downloaded PDFs into a highly structured, keyword-driven format.

By leveraging the Crossref API and Google's Gemini AI, PaperIsHere converts chaotic filenames into clean, manageable strings using a strictly formatted PascalCase structure.

## ✨ Core Features
* **AI Keyword Naming:** Integrates with Gemini 1.5 Flash API to aggressively filter out stop words and academic filler, resulting in a hyper-condensed PascalCase title (e.g., `2015SuddabyG-EntrepreneurshipQualitativeConstructionDiscoveryOpportunity.pdf`).
* **Crossref Integration:** Prioritizes precise metadata retrieval from the official Crossref database using DOIs.
* **Open Access Prioritization:** Integrates with Unpaywall to locate free, legal versions of academic articles.
* **Smart Sci-Hub Bypass:** Dynamically finds active Sci-Hub mirrors and extracts direct PDF blobs to bypass strict CORS and `Failed to fetch` errors.
* **Privacy First:** Your Gemini API key is stored locally in your browser and never sent to external servers.

## 🛠️ Installation (Developer Mode)
1. Download this repository as a `.zip` file and extract it.
2. Open Google Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the extracted `PaperIsHere` folder.

## ⚙️ Configuration
1. Get a free Gemini API Key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click the PaperIsHere icon in your Chrome extensions bar.
3. Paste your API key and click **SAVE CONFIGURATION**.

## ⚖️ License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.