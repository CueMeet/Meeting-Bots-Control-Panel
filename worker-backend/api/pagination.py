from collections import OrderedDict
from rest_framework import pagination
from rest_framework.response import Response


class ResultsPagination(pagination.PageNumberPagination):
    
    page_size_query_param = 'page_size'
    max_page_size = 20

    def get_page_size(self, request):
        if self.page_size_query_param:
            page_size = min(int(request.query_params.get(self.page_size_query_param, self.page_size)), self.max_page_size)
            if page_size > 0:
                return page_size
            elif page_size == 0:
                return None
        return self.page_size


    def get_paginated_response(self, data):
        return Response(OrderedDict({
            'data': data,
            'metadata': OrderedDict([
                ('count', self.page.paginator.count),
                ('page_size', self.page.paginator.per_page),
                ('page_count', self.page.paginator.num_pages),
                ('next', self.page.next_page_number() if self.page.has_next() else None),
                ('previous', self.page.previous_page_number() if self.page.has_previous() else None),
                ('has_next', self.page.has_next()),
                ('has_previous', self.page.has_previous()),
            ])
        }))