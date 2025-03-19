import nltk


def init(nltk_download_dir: str):
    nltk.data.path.append(nltk_download_dir)
    nltk.download('punkt_tab', download_dir=nltk_download_dir)